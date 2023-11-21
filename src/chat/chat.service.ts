import { BadRequestException, CACHE_MANAGER, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma-module/prisma.service';
import { AiService } from 'ai/ai.service';
import { Observable } from 'rxjs';
import { Cache } from 'cache-manager';
import crypto from 'crypto';
import { Permission, Role } from '@poly/model';
import { Conversation, ConversationMessage, User, Prisma } from '@prisma/client';
import { AuthData } from 'common/types';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(
    private readonly aiService: AiService,
    private readonly prisma: PrismaService,
    @Inject(CACHE_MANAGER) private cacheManager: Cache,
  ) {}

  public async storeMessage(message: string) {
    const uuid = crypto.randomUUID();

    const messageKey = this.getMessageKey(uuid);

    this.logger.debug(`Storing message in cache manager with key: ${messageKey}`);

    await this.cacheManager.set(messageKey, { message });
    this.logger.debug(`Stored message: ${message}`);

    return {
      uuid,
    };
  }

  public async sendQuestion(
    environmentId: string,
    userId: string,
    message: string | null,
    uuid: string | null,
    workspaceFolder = '',
    language = '',
  ): Promise<Observable<string>> {
    let eventSource: any;

    if (uuid) {
      const messageKey = this.getMessageKey(uuid);
      const storedMessage = await this.cacheManager.get(messageKey);

      if (!storedMessage) {
        this.logger.error(`Key ${messageKey} not found.`);
        throw new NotFoundException('Message not found');
      }

      this.logger.debug(`Sending question to science server with key ${messageKey}`);

      eventSource = this.aiService.getFunctionCompletion(environmentId, userId, messageKey, workspaceFolder, language);
    } else if (message) {
      const { uuid } = await this.storeMessage(message);
      const messageKey = this.getMessageKey(uuid);

      this.logger.debug(`Sending question to science server with uuid ${messageKey}`);

      eventSource = this.aiService.getFunctionCompletion(environmentId, userId, messageKey, workspaceFolder, language);
    } else {
      throw new Error('At least one of `message` or `uuid` must be provided.');
    }

    const removeMessageFromRedis = () => {
      if (uuid) {
        const messageKey = this.getMessageKey(uuid);
        this.cacheManager
          .del(messageKey)
          .then(() => {
            this.logger.debug(
              `Message key ${messageKey} removed from cache manager after science server message is fully received.`,
            );
          })
          .catch((err) => {
            this.logger.error(
              `Couldn't delete message key ${messageKey} from cache manager after science server message is fully received`,
              err,
            );
          });
      }
    };

    return new Observable<string>((subscriber) => {
      eventSource.onmessage = (event) => {
        try {
          subscriber.next(JSON.parse(event.data).chunk);
        } catch (error) {
          this.logger.error('Error while parsing event from science server', error.stack, {
            event,
          });
          subscriber.error(error.message);
          subscriber.complete();
          eventSource.close();
        }
      };

      eventSource.addEventListener('close', () => {
        this.logger.debug(`Received 'close' event from science server for message with uuid ${uuid}`);
        subscriber.next(undefined);
        subscriber.complete();
        eventSource.close();
        removeMessageFromRedis();
      });

      eventSource.onerror = (error) => {
        if (error.data) {
          this.logger.debug(`Error from Science server for function completion: ${error.data}`);
          const msg = JSON.parse(error.data).message;
          subscriber.error(msg);
        } else if (error.message) {
          this.logger.debug(`Error from Science server for function completion: ${error.message}`);
          subscriber.error(error.message);
        }
        subscriber.complete();
        eventSource.close();
        removeMessageFromRedis();
      };
    });
  }

  async processCommand(environmentId: string, userId: string, command: string) {
    this.logger.debug(`Processing chat command: ${command}`);
    const [commandName] = command.split(' ');

    switch (commandName) {
      case 'c':
      case 'clear':
        await this.aiService.clearConversation(environmentId, userId);
        break;
      default:
        break;
    }
  }

  async getConversationIdsForUser(requestor: User, userId: string, workspaceFolder: string): Promise<string[]> {
    // let's filter down to what a user has access to
    let where: Prisma.ConversationWhereInput = {};

    if (requestor.role === Role.SuperAdmin) {
      // a super admin can see everything!
      where = { userId, workspaceFolder };
    } else if (requestor.role === Role.Admin) {
      // an admin can see everything in their own tenant
      const tenantUserIds: string[] = (
        await this.prisma.user.findMany({
          where: { tenantId: requestor.tenantId },
          select: { id: true },
        })
      ).map((d) => d.id);
      const tenantApplicationIds: string[] = (
        await this.prisma.application.findMany({
          where: { tenantId: requestor.tenantId },
          select: { id: true },
        })
      ).map((d) => d.id);

      if (userId) {
        // show just conversations for requested userId
        if (!tenantUserIds.includes(userId)) {
          throw new BadRequestException('userId not found in tenant');
        }
        where = { userId, workspaceFolder };
      } else {
        // show conversations for all userIds
        where = {
          OR: [{ userId: { in: tenantUserIds } }, { applicationId: { in: tenantApplicationIds } }],
          workspaceFolder,
        };
      }
    } else {
      // a regular user can only see their own conversations
      where = { userId: requestor.id, workspaceFolder };
    }
    const conversations = await this.prisma.conversation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: 100, // limit to 100 results for now
    });
    return conversations.map((c) => c.id);
  }

  async getConversationIds(auth: AuthData, userId: string, workspaceFolder: string): Promise<string[]> {
    // get all the conversationIds the auth'd user or app has access to
    // limit to just `userId` conversations if a valid userId is passed

    if (auth.application) {
      // an application can only see its own conversations
      // userId is ignored
      const conversations = await this.prisma.conversation.findMany({
        where: { applicationId: auth.application.id, workspaceFolder },
        orderBy: { createdAt: 'desc' },
        take: 100,
      });
      return conversations.map((c) => c.id);
    }

    if (!auth.user) {
      throw new BadRequestException("Error, request must be auth'd with user or application");
    }

    return this.getConversationIdsForUser(auth.user, userId, workspaceFolder);
  }

  async getConversationDetail(auth: AuthData, userId: string, conversationId: string): Promise<unknown> {
    // user is the user for permissions purposes whereas userId is which userId to see last convo for
    let conversation: Conversation;
    let where: Prisma.ConversationWhereInput;
    if (userId && conversationId === 'last') {
      where = { userId };
    } else {
      where = { id: conversationId };
    }
    try {
      conversation = await this.prisma.conversation.findFirstOrThrow({ where, orderBy: { createdAt: 'desc' } });
    } catch {
      return new Promise((resolve) => resolve('Conversation not found.'));
    }

    await this.checkConversationDetailPermissions(auth, conversation);

    const messages = await this.prisma.conversationMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });
    const serialized = this._serialize(messages);
    return { conversationGuid: conversation.id, messages: serialized };
  }

  async getConversationDetailBySlug(authData: AuthData, conversationSlug: string): Promise<unknown> {
    // user is the user for permissions purposes whereas userId is which userId to see last convo for
    let conversation: Conversation;
    const where = this._getConversationWhereInput(authData, conversationSlug);
    try {
      conversation = await this.prisma.conversation.findFirstOrThrow({ where, orderBy: { createdAt: 'desc' } });
    } catch {
      return new Promise((resolve) => resolve('Conversation not found.'));
    }

    const messages = await this.prisma.conversationMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });
    const serialized = this._serialize(messages);
    return { conversationGuid: conversation.id, messages: serialized };
  }

  _serialize(messages: ConversationMessage[]) {
    const rv: unknown[] = [];
    for (const message of messages) {
      rv.push({ role: message.role, content: message.content, createdAt: message.createdAt });
    }
    return rv;
  }

  async checkConversationDetailPermissions(auth: AuthData, conversation: Conversation) {
    // return null if user has permission, otherwise throw an exception
    if (auth.application) {
      if (auth.application.id === conversation.applicationId) {
        // application can access its own conversations
        return null;
      } else {
        throw new BadRequestException('Access Denied For This Application');
      }
    }

    if (!auth.user) {
      throw new BadRequestException('must be user or application to access conversations');
    }

    if (auth.user.role === Role.SuperAdmin) {
      // superadmin can access anything, go for it
      return null;
    }

    if (auth.user.role === Role.Admin) {
      const tenantId = await this.getConversationTenantId(conversation);
      if (auth.user.tenantId === tenantId) {
        // user is admin and is in the right tenant! this is fine
        return null;
      } else {
        throw new BadRequestException('tenant mismatch');
      }
    }

    if (auth.user.role === Role.User && auth.user.id === conversation.userId && auth.permissions[Permission.Execute]) {
      // user is user, is in the right environment and has use permission
      return null;
    }

    throw new BadRequestException('permission denied');
  }

  async getConversationTenantId(conversation: Conversation): Promise<string> {
    if (conversation.userId) {
      const user = await this.prisma.user.findUniqueOrThrow({ where: { id: conversation.userId } });
      return user.tenantId;
    } else if (conversation.applicationId) {
      const app = await this.prisma.user.findUniqueOrThrow({ where: { id: conversation.applicationId } });
      return app.tenantId;
    } else {
      throw new BadRequestException('Conversation had no user or application? this should be impossible');
    }
  }

  async deleteConversation(authData: AuthData, conversationSlug: string): Promise<string> {
    if (!conversationSlug) {
      throw new BadRequestException('Conversation slug is required');
    }

    const where = this._getConversationWhereInput(authData, conversationSlug);
    try {
      await this.prisma.conversation.deleteMany({ where });
    } catch {
      return new Promise((resolve) => resolve('Conversation not found.'));
    }

    return new Promise((resolve) => resolve('Conversation deleted!'));
  }

  _getConversationWhereInput(authData: AuthData, conversationSlug: string): Prisma.ConversationWhereInput {
    let where: Prisma.ConversationWhereInput = {};
    if (authData.user) {
      where = { userId: authData.user.id, slug: conversationSlug };
    } else if (authData.application) {
      where = { applicationId: authData.application.id, slug: conversationSlug };
    } else {
      throw new BadRequestException('user or application is required');
    }
    return where;
  }

  async getHistory(
    userId: string | undefined,
    perPage = 10,
    firstMessageDate: Date | null = null,
    workspaceFolder = '',
  ) {
    if (!userId) {
      return [];
    }

    const conversation = await this.prisma.conversation.findFirst({
      where: { userId, workspaceFolder },
      orderBy: { createdAt: 'desc' },
    });
    if (!conversation) {
      return [];
    }

    const messages = await this.prisma.conversationMessage.findMany({
      where: {
        type: 2,
        role: { in: ['user', 'assistant'] },
        conversation: {
          workspaceFolder,
          id: conversation.id,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: perPage,
      cursor: firstMessageDate ? { createdAt: firstMessageDate } : undefined,
      skip: firstMessageDate ? 1 : undefined,
    });

    return messages.map((message) => {
      return { role: message.role, content: this.parseQuestionContent(message.content), createdAt: message.createdAt };
    });
  }

  private parseQuestionContent(content: string) {
    if (content.match(/Question:/gi)) {
      this.logger.debug(`Parsing special question ${content}`);
      return content.trim().split('Question:')[1].trim().replace(/^"/, '').replace(/"$/, '');
    }
    return content;
  }

  private getMessageKey(uuid: string) {
    return `questions:${uuid}`;
  }
}

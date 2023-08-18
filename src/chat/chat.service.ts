import { CACHE_MANAGER, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { AiService } from 'ai/ai.service';
import { Observable } from 'rxjs';
import { Cache } from 'cache-manager';
import crypto from 'crypto';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly aiService: AiService, private readonly prisma: PrismaService, @Inject(CACHE_MANAGER) private cacheManager: Cache) {}

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

  public async sendQuestion(environmentId: string, userId: string, message: string | null, uuid: string | null): Promise<Observable<string>> {
    let eventSource: any;

    if (uuid) {
      const messageKey = this.getMessageKey(uuid);
      const storedMessage = await this.cacheManager.get(messageKey);

      if (!storedMessage) {
        this.logger.error(`Key ${messageKey} not found.`);
        throw new NotFoundException('Message not found');
      }

      this.logger.debug(`Sending question to science server with key ${messageKey}`);

      eventSource = this.aiService.getFunctionCompletion(environmentId, userId, messageKey);
    } else if (message) {
      const { uuid } = await this.storeMessage(message);
      const messageKey = this.getMessageKey(uuid);

      this.logger.debug(`Sending question to science server with uuid ${messageKey}`);

      eventSource = this.aiService.getFunctionCompletion(environmentId, userId, messageKey);
    } else {
      throw new Error('At least one of `message` or `uuid` must be provided.');
    }

    return new Observable<string>(subscriber => {
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
      eventSource.onerror = (error) => {
        if (error.message) {
          this.logger.debug(`Error from Science server for function completion: ${error.message}`);
          subscriber.error(error.message);
        }
        subscriber.complete();
        eventSource.close();

        if (uuid) {
          const messageKey = this.getMessageKey(uuid);
          this.cacheManager.del(messageKey).then(() => {
            this.logger.debug(`Message key ${messageKey} removed from cache manager after science server message is fully received.`);
          }).catch(err => {
            this.logger.error(`Couldn't delete message key ${messageKey} from cache manager after science server message is fully received`, err);
          });
        }
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

  async getConversationIds(userId: string): Promise<string[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 100, // limit to 100 results for now
    });
    return conversations.map((c) => c.id);
  }

  async getConversationDetail(userId: string, conversationId: string): Promise<string> {
    let conversation;
    let where;
    if (userId && conversationId === 'last') {
      where = { where: { userId }, orderBy: { createdAt: 'desc' } };
    } else {
      where = { where: { id: conversationId } };
    }
    try {
      conversation = await this.prisma.conversation.findFirstOrThrow(where);
    } catch {
      return new Promise((resolve) => resolve('Conversation not found.'));
    }

    const messages = await this.prisma.conversationMessage.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: 'asc' },
    });
    const parts = messages.map((m) => `${m.role.toUpperCase()}\n\n${m.content}`);
    return parts.join('\n\n');
  }

  async getHistory(userId: string | undefined, perPage = 10, firstMessageDate: Date | null = null) {
    if (!userId) {
      return [];
    }

    const messages = await this.prisma.conversationMessage.findMany({
      where: { userId, type: 2, role: { in: ['user', 'assistant'] } },
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
    if (content.match(/Question:/ig)) {
      this.logger.debug(`Parsing special question ${content}`);
      return content.trim().split('Question:')[1].trim().replace(/^"/, '').replace(/"$/, '');
    }
    return content;
  }

  private getMessageKey(uuid: string) {
    return `questions:${uuid}`;
  }
}

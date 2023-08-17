import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { AiService } from 'ai/ai.service';
import { Observable } from 'rxjs';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly aiService: AiService, private readonly prisma: PrismaService) {}

  public sendQuestion(
    environmentId: string,
    userId: string,
    message: string,
    workspaceFolder = '',
  ): Promise<Observable<string>> {
    return this.aiService.getFunctionCompletion(environmentId, userId, message, workspaceFolder);
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

  async getConversationIds(userId: string, workspaceFolder: string): Promise<string[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { userId, workspaceFolder },
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

  async getHistory(userId: string | undefined, perPage = 10, firstMessageDate: Date | null = null, workspaceFolder: string) {
    if (!userId) {
      return [];
    }

    const messages = await this.prisma.conversationMessage.findMany({
      where: {
        userId,
        type: 2,
        role: { in: ['user', 'assistant'] },
        conversation: {
          workspaceFolder,
        },
      },
      orderBy: { createdAt: 'desc' },
      take: perPage,
      cursor: firstMessageDate ? { createdAt: firstMessageDate } : undefined,
      skip: firstMessageDate ? 1 : undefined,
      include: {
        conversation: true,
      },
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
}

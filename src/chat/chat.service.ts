import { Injectable, Logger } from '@nestjs/common';
import { ChatText } from '@poly/common';
import { AiService } from 'ai/ai.service';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly aiService: AiService) {
  }

  public async getMessageResponseTexts(environmentId: string, userId: string, message: string): Promise<ChatText[]> {
    const { answer, stats } = await this.aiService.getFunctionCompletion(environmentId, userId, message);

    return [{
      type: 'markdown',
      value: answer,
      stats,
    }];
  }

  async processCommand(environmentId: string, userId: string, command: string) {
    this.logger.debug(`Processing chat command: ${command}`);
    const [commandName] = command.split(' ');

    switch (commandName) {
      case 'clear':
        await this.aiService.clearConversation(environmentId, userId);
        break;
    }
  }
}

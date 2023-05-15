import { Injectable, Logger } from '@nestjs/common';
import { ChatText, SendQuestionMessageEventDto } from '@poly/common';
import { AiService } from 'ai/ai.service';
import { Observable } from 'rxjs';

@Injectable()
export class ChatService {
  private readonly logger = new Logger(ChatService.name);

  constructor(private readonly aiService: AiService) {
  }

  public sendQuestion(userId: number, message: string): Observable<string> {
    return this.aiService.getFunctionCompletion(userId, message);
  }

  async processCommand(userId: string, command: string) {
    this.logger.debug(`Processing chat command: ${command}`);
    const [commandName] = command.split(' ');

    switch (commandName) {
      case 'clear':
        await this.aiService.clearConversation(userId);
        break;
    }
  }
}

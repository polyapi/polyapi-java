import { Req, Body, Controller, Logger, Post, UseGuards, Sse, MessageEvent, Query } from '@nestjs/common';
import {
  SendQuestionDto,
  SendCommandDto,
  SendConfigureDto,
  Role,
  SendQuestionMessageEventDto,
} from '@poly/common';
import { ChatService } from 'chat/chat.service';
import { ApiKeyGuard } from 'auth/api-key-auth-guard.service';
import { AiService } from 'ai/ai.service';
import { catchError, map, Observable } from 'rxjs';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly service: ChatService, private readonly aiService: AiService) {
  }

  @UseGuards(ApiKeyGuard)
  @Sse('/question')
  public sendQuestion(@Req() req, @Query() data: SendQuestionDto): Observable<MessageEvent> {
    this.logger.debug(`Sending question to chat: ${data.message}`);

    return this.service.sendQuestion(req.user.id, data.message)
      .pipe(
        map(data => ({
            data,
          }),
        ),
      );
  }

  @Post('/command')
  @UseGuards(ApiKeyGuard)
  public async sendCommand(@Req() req, @Body() body: SendCommandDto) {
    await this.service.processCommand(req.user.id, body.command);
  }

  @UseGuards(new ApiKeyGuard([Role.Admin]))
  @Post('/ai-configuration')
  async aiConfiguration(@Req() req, @Body() body: SendConfigureDto): Promise<string> {
    await this.aiService.configure(body.name, body.value);
    return 'chirp';
  }
}

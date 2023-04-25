import { Req, Body, Controller, Logger, Post, UseGuards } from '@nestjs/common';
import { SendQuestionDto, SendQuestionResponseDto, SendCommandDto, SendConfigureDto, Role } from '@poly/common';
import { ChatService } from 'chat/chat.service';
import { PolyKeyGuard } from 'auth/poly-key-auth-guard.service';
import { AiService } from 'ai/ai.service';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(private readonly service: ChatService, private readonly aiService: AiService) {}

  @Post('/question')
  @UseGuards(PolyKeyGuard)
  public async sendQuestion(@Req() req, @Body() body: SendQuestionDto): Promise<SendQuestionResponseDto> {
    const responseTexts = await this.service.getMessageResponseTexts(req.user.id, body.message);
    return {
      texts: responseTexts,
    };
  }

  @Post('/command')
  @UseGuards(PolyKeyGuard)
  public async sendCommand(@Req() req, @Body() body: SendCommandDto) {
    await this.service.processCommand(req.user.id, body.command);
  }

  @UseGuards(new PolyKeyGuard([Role.Admin]))
  @Post('/ai-configuration')
  async aiConfiguration(@Req() req, @Body() body: SendConfigureDto): Promise<string> {
    await this.aiService.configure(body.name, body.value);
    return "chirp"
  }
}

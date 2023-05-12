import { Req, Body, Controller, Logger, Post, UseGuards, InternalServerErrorException } from '@nestjs/common';
import { SendQuestionDto, SendQuestionResponseDto, SendCommandDto, SendConfigureDto, Role } from '@poly/common';
import { ChatService } from 'chat/chat.service';
import { PolyKeyGuard } from 'auth/poly-key-auth-guard.service';
import { AiService } from 'ai/ai.service';
import { AuthRequest } from 'common/types';
import { UserService } from 'user/user.service';

@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly service: ChatService,
    private readonly aiService: AiService,
    private readonly userService: UserService,
  ) {
  }

  @UseGuards(PolyKeyGuard)
  @Post('/question')
  public async sendQuestion(@Req() req: AuthRequest, @Body() body: SendQuestionDto): Promise<SendQuestionResponseDto> {
    const environmentId = req.user.environment.id;
    const userId = req.user.user?.id || (await this.userService.findAdminUserByEnvironmentId(environmentId))?.id;

    if (!userId) {
      throw new InternalServerErrorException('Cannot find user to process command');
    }

    const responseTexts = await this.service.getMessageResponseTexts(environmentId, userId, body.message);
    return {
      texts: responseTexts,
    };
  }

  @UseGuards(PolyKeyGuard)
  @Post('/command')
  public async sendCommand(@Req() req: AuthRequest, @Body() body: SendCommandDto) {
    const environmentId = req.user.environment.id;
    const userId = req.user.user?.id || (await this.userService.findAdminUserByEnvironmentId(environmentId))?.id;

    if (!userId) {
      throw new InternalServerErrorException('Cannot find user to process command');
    }

    await this.service.processCommand(environmentId, userId, body.command);
  }

  @UseGuards(new PolyKeyGuard([Role.SuperAdmin]))
  @Post('/ai-configuration')
  async aiConfiguration(@Req() req: AuthRequest, @Body() body: SendConfigureDto): Promise<string> {
    await this.aiService.configure(body.name, body.value);
    return 'chirp';
  }
}

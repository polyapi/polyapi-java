import {
  Req,
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
  Sse,
  InternalServerErrorException,
  Param,
  Get,
  Header,
  Query,
  MessageEvent,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import {
  SendQuestionDto,
  SendCommandDto,
  SendConfigureDto,
  TeachSystemPromptDto,
  TeachSystemPromptResponseDto,
  Role,
  Permission,
} from '@poly/common';
import { ApiSecurity } from '@nestjs/swagger';
import { ChatService } from 'chat/chat.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { AiService } from 'ai/ai.service';
import { AuthRequest } from 'common/types';
import { UserService } from 'user/user.service';
import { AuthService } from 'auth/auth.service';

@ApiSecurity('PolyApiKey')
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly service: ChatService,
    private readonly aiService: AiService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
  ) {}

  @UseGuards(PolyAuthGuard)
  @Sse('/question')
  public async sendQuestion(@Req() req, @Query() data: SendQuestionDto): Promise<Observable<MessageEvent>> {
    const environmentId = req.user.environment.id;
    const userId = req.user.user?.id || (await this.userService.findAdminUserByEnvironmentId(environmentId))?.id;

    if (!userId) {
      throw new InternalServerErrorException('Cannot find user to process command');
    }

    await this.authService.checkPermissions(req.user, Permission.Use);

    this.logger.debug(`Sending question to chat: ${data.message}`);

    return this.service.sendQuestion(environmentId, userId, data.message)
      .pipe(
        map(data => ({
          data,
        }),
        ),
      );
  }

  @UseGuards(PolyAuthGuard)
  @Post('/command')
  public async sendCommand(@Req() req: AuthRequest, @Body() body: SendCommandDto) {
    const environmentId = req.user.environment.id;
    const userId = req.user.user?.id || (await this.userService.findAdminUserByEnvironmentId(environmentId))?.id;

    if (!userId) {
      throw new InternalServerErrorException('Cannot find user to process command');
    }

    await this.authService.checkPermissions(req.user, Permission.Use);

    await this.service.processCommand(environmentId, userId, body.command);
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Post('/ai-configuration')
  async aiConfiguration(@Req() req: AuthRequest, @Body() body: SendConfigureDto): Promise<string> {
    await this.aiService.configure(body.name, body.value);
    return 'chirp';
  }

  @UseGuards(new PolyAuthGuard([Role.Admin, Role.SuperAdmin]))
  @Post('/system-prompt')
  async teachSystemPrompt(
    @Req() req: AuthRequest,
    @Body() body: TeachSystemPromptDto,
  ): Promise<TeachSystemPromptResponseDto> {
    const environmentId = req.user.environment.id;
    const userId = req.user.user?.id || (await this.userService.findAdminUserByEnvironmentId(environmentId))?.id;

    if (!userId) {
      throw new InternalServerErrorException('Cannot find user to process command');
    }

    await this.aiService.setSystemPrompt(environmentId, userId, body.prompt);
    return { response: 'Conversation cleared and new system prompt set!' };
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Get('/conversations')
  public async conversationsList(
    @Req() req: AuthRequest,
    @Query('userId') userId: string,
  ) {
    const conversationIds = await this.service.getConversationIds(userId);
    return { conversationIds };
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Header('content-type', 'text/plain')
  @Get('/conversations/:conversationId')
  public async conversationsDetail(
    @Req() req: AuthRequest,
    @Query('userId') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    const conversation = await this.service.getConversationDetail(userId, conversationId);
    return conversation;
  }
}

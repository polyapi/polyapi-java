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
  BadRequestException,
} from '@nestjs/common';
import { map, Observable } from 'rxjs';
import {
  SendQuestionDto,
  SendCommandDto,
  TeachSystemPromptDto,
  TeachSystemPromptResponseDto,
  Role,
  Permission,
  Pagination,
  StoreMessageDto,
  MessageUUIDDto,
} from '@poly/model';
import { ApiSecurity } from '@nestjs/swagger';
import { ChatService } from 'chat/chat.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { AiService } from 'ai/ai.service';
import { AuthRequest } from 'common/types';
import { UserService } from 'user/user.service';
import { AuthService } from 'auth/auth.service';
import { MessageDto } from '@poly/model';
import { ChatQuestionsLimitGuard } from 'limit/chat-questions-limit-guard';
import { StatisticsService } from 'statistics/statistics.service';

@ApiSecurity('PolyApiKey')
@Controller('chat')
export class ChatController {
  private readonly logger = new Logger(ChatController.name);

  constructor(
    private readonly service: ChatService,
    private readonly aiService: AiService,
    private readonly userService: UserService,
    private readonly authService: AuthService,
    private readonly statisticsService: StatisticsService,
  ) {}

  @UseGuards(PolyAuthGuard)
  @Post('/store-message')
  public async storeMessage(@Req() req: AuthRequest, @Body() data: StoreMessageDto): Promise<MessageUUIDDto> {
    const environmentId = req.user.environment.id;
    const userId = req.user.user?.id || (await this.userService.findAdminUserByEnvironmentId(environmentId))?.id;

    if (!userId) {
      throw new InternalServerErrorException('Cannot find user to process command');
    }

    await this.authService.checkPermissions(req.user, Permission.Use);

    return this.service.storeMessage(data.message);
  }

  @UseGuards(PolyAuthGuard, ChatQuestionsLimitGuard)
  @Sse('/question')
  public async sendQuestion(@Req() req: AuthRequest, @Query() data: SendQuestionDto): Promise<Observable<MessageEvent>> {
    const environmentId = req.user.environment.id;
    const userId = req.user.user?.id || (await this.userService.findAdminUserByEnvironmentId(environmentId))?.id;

    if (!userId) {
      throw new InternalServerErrorException('Cannot find user to process command');
    }

    await this.authService.checkPermissions(req.user, Permission.Use);

    const message = data.message || null;
    const uuid = data.message_uuid || null;

    if (!message && !uuid) {
      throw new BadRequestException('At least one of `message` or `uuid` must be provided.');
    }

    await this.statisticsService.trackChatQuestion(req.user);

    const observable = await this.service.sendQuestion(environmentId, userId, message, uuid, data.workspaceFolder || '');

    return observable.pipe(
      map((data) => ({
        data,
      })),
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
    return { response: 'New system prompt set!' };
  }

  @UseGuards(new PolyAuthGuard([Role.SuperAdmin]))
  @Get('/conversations')
  public async conversationsList(@Req() req: AuthRequest, @Query() query) {
    const conversationIds = await this.service.getConversationIds(query.userId, query.workspaceFolder || '');
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
    return this.service.getConversationDetail(userId, conversationId);
  }

  @UseGuards(new PolyAuthGuard())
  @Get('/history')
  public async chatHistory(
    @Req() req: AuthRequest,
    @Query() pagination: Pagination,
  ): Promise<MessageDto[]> {
    const { perPage = '10', firstMessageDate = null, workspaceFolder = '' } = pagination;

    // returns the conversation history for this specific user
    const history = await this.service.getHistory(req.user.user?.id, Number(perPage), firstMessageDate, workspaceFolder);

    return history;
  }
}

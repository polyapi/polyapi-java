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
  Query,
  MessageEvent,
  BadRequestException,
  HttpCode,
  HttpStatus,
  UseFilters,
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
import { ApiOperation, ApiSecurity } from '@nestjs/swagger';
import { ChatService } from 'chat/chat.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { AiService } from 'ai/ai.service';
import { AuthRequest } from 'common/types';
import { UserService } from 'user/user.service';
import { AuthService } from 'auth/auth.service';
import { MessageDto } from '@poly/model';
import { ChatQuestionsLimitGuard } from 'limit/chat-questions-limit-guard';
import { StatisticsService } from 'statistics/statistics.service';
import { ERROR_CODE, SkipVersionCheck, VersionGuard, VersionSatisfies } from 'common/guards/version';
import { API_TAG_INTERNAL } from 'common/constants';
import { VSCODE_EXTENSION_ACCEPTED_VERSION_RANGE, HEADER_TRIGGER_NAME } from './constants';
import { SseExceptionFilter } from './exception-filter';

@VersionSatisfies({
  value: VSCODE_EXTENSION_ACCEPTED_VERSION_RANGE,
  headerTriggerName: HEADER_TRIGGER_NAME,
})
@ApiSecurity('PolyApiKey')
@UseGuards(VersionGuard)
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

  @ApiOperation({ tags: [API_TAG_INTERNAL], description: 'Used internally by extension' })
  @Get('/version-satisfies')
  @HttpCode(HttpStatus.NO_CONTENT)
  public checkVersion() {
    return null;
  }

  @UseGuards(PolyAuthGuard)
  @Post('/store-message')
  public async storeMessage(@Req() req: AuthRequest, @Body() data: StoreMessageDto): Promise<MessageUUIDDto> {
    const environmentId = req.user.environment.id;
    const userId = req.user.user?.id || (await this.userService.findAdminUserByEnvironmentId(environmentId))?.id;

    if (!userId) {
      throw new InternalServerErrorException('Cannot find user to process command');
    }

    await this.authService.checkPermissions(req.user, Permission.Execute);

    return this.service.storeMessage(data.message);
  }

  @UseGuards(PolyAuthGuard, ChatQuestionsLimitGuard)
  @UseFilters(new SseExceptionFilter((exception) => {
    const exceptionResponse = exception.getResponse();

    return (exceptionResponse as any)?.code === ERROR_CODE ? ERROR_CODE : null;
  }))
  @Sse('/question')
  public async sendQuestion(@Req() req: AuthRequest, @Query() data: SendQuestionDto): Promise<Observable<MessageEvent>> {
    const hasVersionHeader = typeof req.headers[HEADER_TRIGGER_NAME] === 'undefined' ? !!req.headers['x-version'] : true;
    /*
      This is needed for vscode extension versions < 0.7.0 that do not send x-version header.;
    */
    if (!hasVersionHeader) {
      const observable = new Observable<string>(subscriber => {
        subscriber.next('Your PolyAPI Vs Code extension is out of date, please update it [here](https://marketplace.visualstudio.com/items?itemName=PolyAPICorp.polyapi-vscode-extension)');
        subscriber.complete();
      });

      return observable.pipe<MessageEvent>(map(data => ({ data, type: 'message' })));
    }

    const environmentId = req.user.environment.id;
    const userId = req.user.user?.id || (await this.userService.findAdminUserByEnvironmentId(environmentId))?.id;

    if (!userId) {
      throw new InternalServerErrorException('Cannot find user to process command');
    }

    await this.authService.checkPermissions(req.user, Permission.Execute);

    const message = data.message || null;
    const uuid = data.message_uuid || null;

    if (!message && !uuid) {
      throw new BadRequestException('At least one of `message` or `uuid` must be provided.');
    }

    await this.statisticsService.trackChatQuestion(req.user);

    const observable = await this.service.sendQuestion(environmentId, userId, message, uuid, data.workspaceFolder || '', data.language);

    return observable.pipe<MessageEvent>(
      map((data) => ({
        /*
          We have to send a non-falsy value here, if not, client code executes `onerror` event instead of `close` event.
          There is a different behavior when we receive events from science server (see method `this.service.sendQuestion`) in which we are able to receive an empty string as data on `close`
          event. May be nest implementation does not send message properly when passing falsy value like an empty string, sending an string with an empty
          space inside allows client (vscode extension in this case) to handle this data inside `close` event.
        */
        data: data === undefined ? ' ' : data,
        type: data === undefined ? 'close' : 'message',
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

    await this.authService.checkPermissions(req.user, Permission.Execute);

    await this.service.processCommand(environmentId, userId, body.command);
  }

  @SkipVersionCheck()
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

  @SkipVersionCheck()
  @UseGuards(PolyAuthGuard)
  @Get('/conversations')
  public async conversationsList(@Req() req: AuthRequest, @Query() query) {
    const conversationIds = await this.service.getConversationIds(req.user, query.userId, query.workspaceFolder);
    return { conversationIds };
  }

  @SkipVersionCheck()
  @UseGuards(PolyAuthGuard)
  @Get('/conversations/:conversationId')
  public async conversationsDetail(
    @Req() req: AuthRequest,
    @Query('userId') userId: string,
    @Param('conversationId') conversationId: string,
  ) {
    return this.service.getConversationDetail(req.user, userId, conversationId);
  }

  @UseGuards(PolyAuthGuard)
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

import {
  Req,
  Body,
  Controller,
  Logger,
  Post,
  UseGuards,
  InternalServerErrorException,
  Param,
  Get,
  Header,
  Query,
  ValidationPipe,
} from '@nestjs/common';
import {
  SendQuestionDto,
  SendQuestionResponseDto,
  SendCommandDto,
  TeachSystemPromptDto,
  TeachSystemPromptResponseDto,
  Role,
  Permission,
  Pagination,
} from '@poly/model';
import { ApiSecurity } from '@nestjs/swagger';
import { ChatService } from 'chat/chat.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { AiService } from 'ai/ai.service';
import { AuthRequest } from 'common/types';
import { UserService } from 'user/user.service';
import { AuthService } from 'auth/auth.service';
import { MessageDto } from '@poly/model';
import { MergeRequestData } from 'common/decorators';

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
  @Post('/question')
  public async sendQuestion(@Req() req: AuthRequest, @Body() body: SendQuestionDto): Promise<SendQuestionResponseDto> {
    const environmentId = req.user.environment.id;
    const userId = req.user.user?.id || (await this.userService.findAdminUserByEnvironmentId(environmentId))?.id;

    if (!userId) {
      throw new InternalServerErrorException('Cannot find user to process command');
    }

    await this.authService.checkPermissions(req.user, Permission.Use);

    const responseTexts = await this.service.getMessageResponseTexts(environmentId, userId, body.message);
    return {
      texts: responseTexts,
    };
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
  public async conversationsList(@Req() req: AuthRequest, @Query('userId') userId: string) {
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

  @UseGuards(new PolyAuthGuard())
  @Get('/history')
  public async chatHistory(
    @Req() req: AuthRequest,
    @MergeRequestData(['query'], new ValidationPipe({ validateCustomDecorators: true, transform: true })) pagination: Pagination,
  ): Promise<MessageDto[]> {
    const {
      perPage = '10',
      firstMessageDate = null,
    } = pagination;

    // returns the conversation history for this specific user
    const history = await this.service.getHistory(req.user.user?.id, Number(perPage), firstMessageDate);

    return history;
  }
}

import { Body, Controller, InternalServerErrorException, Logger, Post, Req, UseGuards } from '@nestjs/common';
import {
  Permission,
  Role,
  TeachDto,
  TeachSystemPromptDto,
  TeachSystemPromptResponseDto,
  TeachResponseDto
} from '@poly/common';
import { FunctionService } from 'function/function.service';
import { PolyKeyGuard } from 'auth/poly-key-auth-guard.service';
import { AuthRequest } from 'common/types';
import { AuthService } from 'auth/auth.service';
import { UserService } from 'user/user.service';

@Controller('teach')
export class TeachController {
  private logger: Logger = new Logger(TeachController.name);

  public constructor(
    private readonly functionService: FunctionService,
    private readonly authService: AuthService,
    private readonly userService: UserService,
  ) {
  }

  @UseGuards(PolyKeyGuard)
  @Post()
  async teach(@Req() req: AuthRequest, @Body() teachDto: TeachDto): Promise<TeachResponseDto> {
    const {
      url,
      body,
      name = null,
      context = null,
      description = null,
      payload = null,
      response,
      variables = {},
      statusCode,
      templateHeaders,
      method,
      templateAuth,
      templateUrl,
      templateBody,
      id = null,
    } = teachDto;
    const environmentId = req.user.environment.id;

    await this.authService.checkPermissions(req.user, Permission.Teach);

    this.logger.debug(`Teaching API function in environment ${environmentId}...`);
    this.logger.debug(
      `name: ${name}, context: ${context}, description: ${description}, payload: ${payload}, response: ${response}, statusCode: ${statusCode}`,
    );

    return this.functionService.teach(
      id,
      environmentId,
      url,
      body,
      name,
      context,
      description,
      payload,
      response,
      variables,
      statusCode,
      templateHeaders,
      method,
      templateUrl,
      templateBody,
      templateAuth,
    );
  }

  @UseGuards(new PolyKeyGuard([Role.Admin]))
  @Post('/system-prompt')
  async teachSystemPrompt(@Req() req: AuthRequest, @Body() body: TeachSystemPromptDto): Promise<TeachSystemPromptResponseDto> {
    const environmentId = req.user.environment.id;
    const userId = req.user.user?.id || (await this.userService.findAdminUserByEnvironmentId(environmentId))?.id;

    if (!userId) {
      throw new InternalServerErrorException('Cannot find user to process command');
    }

    await this.functionService.setSystemPrompt(environmentId, userId, body.prompt);
    return { response: 'Conversation cleared and new system prompt set!' };
  }
}

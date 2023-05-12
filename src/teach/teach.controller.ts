import { Body, Controller, InternalServerErrorException, Logger, Param, Post, Req, UseGuards } from '@nestjs/common';
import {
  Permission,
  Role,
  TeachDetailsDto,
  TeachDto,
  TeachResponseDto,
  TeachSystemPromptDto,
  TeachSystemPromptResponseDto,
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
    const { url, method, name, description, headers, body, auth } = teachDto;
    const environmentId = req.user.environment.id;

    await this.authService.checkPermissions(req.user, Permission.Teach);

    this.logger.debug(`Teaching ${method} ${url} with name '${name}' in environment ${environmentId}...`);
    const apiFunction = await this.functionService.createOrUpdateApiFunction(
      environmentId,
      url,
      method,
      name,
      description,
      headers,
      body,
      auth,
    );

    return {
      functionId: apiFunction.id,
    };
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

  @UseGuards(PolyKeyGuard)
  @Post('/:functionId')
  async teachDetails(
    @Req() req: AuthRequest,
    @Param('functionId') id: string,
    @Body() teachDetailsDto: TeachDetailsDto,
  ): Promise<void> {
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
    } = teachDetailsDto;
    const environmentId = req.user.environment.id;

    await this.authService.checkPermissions(req.user, Permission.Teach);

    this.logger.debug(`Teaching details of function ${id} in environment ${environmentId}...`);
    this.logger.debug(
      `name: ${name}, context: ${context}, description: ${description}, payload: ${payload}, response: ${response}, statusCode: ${statusCode}`,
    );

    await this.functionService.updateApiFunctionDetails(
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
    );
  }
}

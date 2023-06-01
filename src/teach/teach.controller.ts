import { Body, Controller, Logger, Post, Req, UseGuards } from '@nestjs/common';
import {
  Permission,
  TeachDto,
  TeachResponseDto
} from '@poly/common';
import { ApiSecurity } from '@nestjs/swagger';
import { FunctionService } from 'function/function.service';
import { PolyKeyGuard } from 'auth/poly-key-auth-guard.service';
import { AuthRequest } from 'common/types';
import { AuthService } from 'auth/auth.service';
import { UserService } from 'user/user.service';

@ApiSecurity('X-PolyApiKey')
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
      requestName,
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
      requestName,
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
}

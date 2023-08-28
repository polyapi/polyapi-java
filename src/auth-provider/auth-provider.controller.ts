import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiSecurity } from '@nestjs/swagger';
import { AuthProviderService } from 'auth-provider/auth-provider.service';
import { AuthTokenDto, CreateAuthProviderDto, ExecuteAuthProviderDto, ExecuteAuthProviderResponseDto, Permission, UpdateAuthProviderDto } from '@poly/model';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { AuthRequest } from 'common/types';
import { AuthService } from 'auth/auth.service';
import { VariableService } from 'variable/variable.service';
import { LimitService } from 'limit/limit.service';
import { FunctionCallsLimitGuard } from 'limit/function-calls-limit-guard';
import { StatisticsService } from 'statistics/statistics.service';
import { FUNCTIONS_LIMIT_REACHED } from '@poly/common/messages';

@ApiSecurity('PolyApiKey')
@Controller('auth-providers')
export class AuthProviderController {
  private readonly logger = new Logger(AuthProviderController.name);

  constructor(
    private readonly service: AuthProviderService,
    private readonly authService: AuthService,
    private readonly variableService: VariableService,
    private readonly limitService: LimitService,
    private readonly statisticsService: StatisticsService,
  ) {
  }

  @UseGuards(PolyAuthGuard)
  @Get()
  async getAuthProviders(@Req() req: AuthRequest) {
    return (await this.service.getAuthProviders(req.user.environment.id))
      .map(authProvider => this.service.toAuthProviderDto(authProvider));
  }

  @UseGuards(PolyAuthGuard)
  @Get(':id')
  async getAuthProvider(@Req() req: AuthRequest, @Param('id') id: string) {
    const authProvider = await this.service.getAuthProvider(id);
    if (!authProvider) {
      throw new NotFoundException();
    }

    await this.authService.checkEnvironmentEntityAccess(authProvider, req.user);
    return this.service.toAuthProviderDto(authProvider);
  }

  @UseGuards(PolyAuthGuard)
  @Post()
  async createAuthProvider(@Req() req: AuthRequest, @Body() data: CreateAuthProviderDto) {
    const {
      name = '',
      context,
      authorizeUrl,
      tokenUrl,
      revokeUrl = null,
      introspectUrl = null,
      audienceRequired = false,
      refreshEnabled = false,
    } = data;

    const functionCount = this.service.getFunctionCount(introspectUrl, revokeUrl, refreshEnabled);
    if (!await this.limitService.checkTenantFunctionsLimit(req.user.tenant, functionCount)) {
      this.logger.debug(`Tenant ${req.user.tenant.id} reached its limit of functions while creating auth provider functions.`);
      throw new HttpException(FUNCTIONS_LIMIT_REACHED, HttpStatus.TOO_MANY_REQUESTS);
    }
    await this.authService.checkPermissions(req.user, Permission.AuthConfig);

    return this.service.toAuthProviderDto(
      await this.service.createAuthProvider(req.user.environment, name, context, authorizeUrl, tokenUrl, revokeUrl, introspectUrl, audienceRequired, refreshEnabled),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Patch(':id')
  async updateAuthProvider(@Req() req: AuthRequest, @Param('id') id: string, @Body() data: UpdateAuthProviderDto) {
    const {
      name,
      context,
      authorizeUrl,
      tokenUrl,
      revokeUrl,
      introspectUrl,
      audienceRequired,
      refreshEnabled,
      visibility,
    } = data;

    const authProvider = await this.service.getAuthProvider(id);
    if (!authProvider) {
      throw new NotFoundException();
    }

    const currentFunctionCount = this.service.getFunctionCount(authProvider.introspectUrl, authProvider.revokeUrl, authProvider.refreshEnabled);
    const updatedFunctionCount = this.service.getFunctionCount(
      introspectUrl === null ? introspectUrl : authProvider.introspectUrl,
      revokeUrl === null ? revokeUrl : authProvider.revokeUrl,
      refreshEnabled ?? authProvider.refreshEnabled,
    );
    if (updatedFunctionCount > currentFunctionCount && !await this.limitService.checkTenantFunctionsLimit(req.user.tenant, updatedFunctionCount - currentFunctionCount)) {
      this.logger.debug(`Tenant ${req.user.tenant.id} reached its limit of functions while creating auth provider functions.`);
      throw new HttpException(FUNCTIONS_LIMIT_REACHED, HttpStatus.TOO_MANY_REQUESTS);
    }

    await this.authService.checkEnvironmentEntityAccess(authProvider, req.user, false, Permission.AuthConfig);

    return this.service.toAuthProviderDto(
      await this.service.updateAuthProvider(authProvider, name, context, authorizeUrl, tokenUrl, revokeUrl, introspectUrl, audienceRequired, refreshEnabled, visibility),
    );
  }

  @UseGuards(PolyAuthGuard)
  @Delete(':id')
  async deleteAuthProvider(@Req() req: AuthRequest, @Param('id') id: string) {
    const authProvider = await this.service.getAuthProvider(id);
    if (!authProvider) {
      throw new NotFoundException();
    }

    await this.authService.checkEnvironmentEntityAccess(authProvider, req.user, false, Permission.AuthConfig);
    await this.service.deleteAuthProvider(authProvider);
  }

  @UseGuards(PolyAuthGuard, FunctionCallsLimitGuard)
  @Post('/:id/execute')
  async executeAuthProvider(@Req() req: AuthRequest, @Param('id') id: string, @Body() data: ExecuteAuthProviderDto): Promise<ExecuteAuthProviderResponseDto> {
    const authProvider = await this.service.getAuthProvider(id, true);
    if (!authProvider) {
      throw new NotFoundException(`Auth provider with id ${id} not found.`);
    }

    await this.authService.checkEnvironmentEntityAccess(authProvider, req.user, true, Permission.Use);
    data = await this.variableService.unwrapVariables(req.user, data);

    await this.statisticsService.trackFunctionCall(req.user, id, 'auth-provider');

    const {
      eventsClientId,
      clientId,
      clientSecret,
      audience = null,
      scopes = [],
      callbackUrl = null,
      userId = null,
    } = data;
    return await this.service.executeAuthProvider(authProvider, eventsClientId, clientId, clientSecret, audience, scopes, callbackUrl, userId);
  }

  @Get('/:id/callback')
  async authProviderCallback(@Res() res, @Param('id') id: string, @Query() query: any): Promise<void> {
    this.logger.debug(`Auth provider callback for ${id} with query ${JSON.stringify(query)}`);
    const redirectUrl = await this.service.processAuthProviderCallback(id, query);
    if (redirectUrl) {
      res.redirect(redirectUrl);
    } else {
      res.sendStatus(HttpStatus.OK);
    }
  }

  @UseGuards(PolyAuthGuard, FunctionCallsLimitGuard)
  @Post('/:id/revoke')
  async revokeToken(@Req() req: AuthRequest, @Param('id') id: string, @Body() tokenDto: AuthTokenDto): Promise<void> {
    const authProvider = await this.service.getAuthProvider(id, true);
    if (!authProvider) {
      throw new NotFoundException(`Auth provider with id ${id} not found.`);
    }

    await this.authService.checkEnvironmentEntityAccess(authProvider, req.user, true, Permission.Use);

    if (!authProvider.revokeUrl) {
      throw new BadRequestException(`Auth provider with id ${id} does not support revocation.`);
    }

    await this.statisticsService.trackFunctionCall(req.user, id, 'auth-provider');

    const { token } = tokenDto;
    await this.service.revokeAuthToken(authProvider, token);
  }

  @UseGuards(PolyAuthGuard, FunctionCallsLimitGuard)
  @Post('/:id/introspect')
  async introspectToken(@Req() req: AuthRequest, @Param('id') id: string, @Body() tokenDto: AuthTokenDto): Promise<any> {
    const authProvider = await this.service.getAuthProvider(id, true);
    if (!authProvider) {
      throw new NotFoundException(`Auth provider with id ${id} not found.`);
    }

    await this.authService.checkEnvironmentEntityAccess(authProvider, req.user, true, Permission.Use);

    if (!authProvider.introspectUrl) {
      throw new BadRequestException(`Auth provider with id ${id} does not support introspection.`);
    }

    await this.statisticsService.trackFunctionCall(req.user, id, 'auth-provider');

    const { token } = tokenDto;
    return await this.service.introspectAuthToken(authProvider, token);
  }

  @UseGuards(PolyAuthGuard, FunctionCallsLimitGuard)
  @Post('/:id/refresh')
  async refreshToken(@Req() req: AuthRequest, @Param('id') id: string, @Body() tokenDto: AuthTokenDto): Promise<any> {
    const authProvider = await this.service.getAuthProvider(id, true);
    if (!authProvider) {
      throw new NotFoundException(`Auth provider with id ${id} not found.`);
    }

    await this.authService.checkEnvironmentEntityAccess(authProvider, req.user, true, Permission.Use);

    if (!authProvider.refreshEnabled) {
      throw new BadRequestException(`Auth provider with id ${id} does not support refresh.`);
    }

    await this.statisticsService.trackFunctionCall(req.user, id, 'auth-provider');

    const { token } = tokenDto;
    return await this.service.refreshAuthToken(authProvider, token);
  }
}

import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
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
import { AuthProviderService } from 'auth-provider/auth-provider.service';
import {
  AuthTokenDto,
  CreateAuthProviderDto,
  ExecuteAuthProviderDto,
  ExecuteAuthProviderResponseDto,
  UpdateAuthProviderDto,
} from '@poly/common';
import { ApiKeyGuard } from 'auth/api-key-auth-guard.service';

@Controller('auth-providers')
export class AuthProviderController {
  private readonly logger = new Logger(AuthProviderController.name);

  constructor(private readonly service: AuthProviderService) {
  }

  @Get()
  @UseGuards(ApiKeyGuard)
  async getAuthProviders(@Req() req) {
    return (await this.service.getAuthProviders(req.user))
      .map(authProvider => this.service.toAuthProviderDto(authProvider));
  }

  @Get(':id')
  @UseGuards(ApiKeyGuard)
  async getAuthProvider(@Req() req, @Param('id') id: string) {
    const authProvider = await this.service.getAuthProvider(req.user, id);
    if (!authProvider) {
      throw new NotFoundException();
    }
    return this.service.toAuthProviderDto(authProvider);
  }

  @Post()
  @UseGuards(ApiKeyGuard)
  async createAuthProvider(@Req() req, @Body() data: CreateAuthProviderDto) {
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
    return this.service.toAuthProviderDto(
      await this.service.createAuthProvider(req.user, name, context, authorizeUrl, tokenUrl, revokeUrl, introspectUrl, audienceRequired, refreshEnabled),
    );
  }

  @Patch(':id')
  @UseGuards(ApiKeyGuard)
  async updateAuthProvider(@Req() req, @Param('id') id: string, @Body() data: UpdateAuthProviderDto) {
    const {
      name,
      context,
      authorizeUrl,
      tokenUrl,
      revokeUrl,
      introspectUrl,
      audienceRequired,
      refreshEnabled,
    } = data;

    const authProvider = await this.service.getAuthProvider(req.user, id);
    if (!authProvider) {
      throw new NotFoundException();
    }

    return this.service.toAuthProviderDto(
      await this.service.updateAuthProvider(req.user, authProvider, name, context, authorizeUrl, tokenUrl, revokeUrl, introspectUrl, audienceRequired, refreshEnabled),
    );
  }

  @Delete(':id')
  @UseGuards(ApiKeyGuard)
  async deleteAuthProvider(@Req() req, @Param('id') id: string) {
    const authProvider = await this.service.getAuthProvider(req.user, id);
    if (!authProvider) {
      throw new NotFoundException();
    }

    await this.service.deleteAuthProvider(req.user, authProvider);
  }

  @Post('/:id/execute')
  @UseGuards(ApiKeyGuard)
  async executeAuthProvider(@Req() req, @Param('id') id: string, @Body() executeAuthProvider: ExecuteAuthProviderDto): Promise<ExecuteAuthProviderResponseDto> {
    const authProvider = await this.service.getAuthProvider(req.user, id);
    if (!authProvider) {
      throw new NotFoundException(`Auth provider with id ${id} not found.`);
    }

    const {
      eventsClientId,
      clientId,
      clientSecret,
      audience = null,
      scopes = [],
      callbackUrl = null,
    } = executeAuthProvider;
    return await this.service.executeAuthProvider(req.user, authProvider, eventsClientId, clientId, clientSecret, audience, scopes, callbackUrl);
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

  @Post('/:id/revoke')
  @UseGuards(ApiKeyGuard)
  async revokeToken(@Req() req, @Param('id') id: string, @Body() tokenDto: AuthTokenDto): Promise<void> {
    const authProvider = await this.service.getAuthProvider(req.user, id);
    if (!authProvider) {
      throw new NotFoundException(`Auth provider with id ${id} not found.`);
    }
    if (!authProvider.revokeUrl) {
      throw new BadRequestException(`Auth provider with id ${id} does not support revocation.`);
    }

    const { token } = tokenDto;
    await this.service.revokeAuthToken(req.user, authProvider, token);
  }

  @Post('/:id/introspect')
  @UseGuards(ApiKeyGuard)
  async introspectToken(@Req() req, @Param('id') id: string, @Body() tokenDto: AuthTokenDto): Promise<any> {
    const authProvider = await this.service.getAuthProvider(req.user, id);
    if (!authProvider) {
      throw new NotFoundException(`Auth provider with id ${id} not found.`);
    }
    if (!authProvider.introspectUrl) {
      throw new BadRequestException(`Auth provider with id ${id} does not support introspection.`);
    }

    const { token } = tokenDto;
    return await this.service.introspectAuthToken(req.user, authProvider, token);
  }

  @Post('/:id/refresh')
  @UseGuards(ApiKeyGuard)
  async refreshToken(@Req() req, @Param('id') id: string, @Body() tokenDto: AuthTokenDto): Promise<any> {
    const authProvider = await this.service.getAuthProvider(req.user, id);
    if (!authProvider) {
      throw new NotFoundException(`Auth provider with id ${id} not found.`);
    }
    if (!authProvider.refreshEnabled) {
      throw new BadRequestException(`Auth provider with id ${id} does not support refresh.`);
    }

    const { token } = tokenDto;
    return await this.service.refreshAuthToken(req.user, authProvider, token);
  }
}

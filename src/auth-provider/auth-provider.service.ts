import crypto from 'crypto';
import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { AuthProvider, AuthToken } from '@prisma/client';
import { catchError, lastValueFrom, map, of } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from 'prisma/prisma.service';
import {
  AuthFunctionSpecification,
  AuthProviderDto,
  ExecuteAuthProviderResponseDto,
  PropertySpecification, Visibility,
} from '@poly/model';
import { ConfigService } from 'config/config.service';
import { EventService } from 'event/event.service';
import { AxiosError } from 'axios';
import { SpecsService } from 'specs/specs.service';
import { CommonService } from 'common/common.service';

@Injectable()
export class AuthProviderService {
  private logger = new Logger(AuthProviderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly commonService: CommonService,
    private readonly eventService: EventService,
    @Inject(forwardRef(() => SpecsService))
    private readonly specsService: SpecsService,
  ) {
  }

  private getAuthProviderFilterConditions(contexts?: string[], ids?: string[]) {
    const contextConditions = contexts?.length
      ? contexts.filter(Boolean).map((context) => {
        return {
          OR: [
            {
              context: { startsWith: `${context}.` },
            },
            {
              context,
            },
          ],
        };
      })
      : [];

    const idConditions = [ids?.length ? { id: { in: ids } } : undefined].filter(Boolean) as any;

    const filterConditions = [
      {
        OR: contextConditions,
      },
    ];

    this.logger.debug(`auth providers filter conditions: ${JSON.stringify([
{ AND: filterConditions },
      ...idConditions,
])}`);

    return [{ AND: filterConditions }, ...idConditions];
  }

  async getAuthProviders(environmentId: string, contexts?: string[], ids?: string[], includePublic = false, includeTenant = false): Promise<AuthProvider[]> {
    return this.prisma.authProvider.findMany({
      where: {
        AND: [
          {
            OR: [
              { environmentId },
              includePublic
                ? this.commonService.getPublicVisibilityFilterCondition()
                : {},
            ],
          },
          {
            OR: this.getAuthProviderFilterConditions(contexts, ids),
          },
        ],
      },
      include: includeTenant
        ? {
            environment: {
              include: {
                tenant: true,
              },
            },
          }
        : undefined,
    });
  }

  async getAuthProvider(id: string): Promise<AuthProvider | null> {
    return this.prisma.authProvider.findFirst({
      where: {
        id,
      },
    });
  }

  async createAuthProvider(
    environmentId: string,
    name: string,
    context: string,
    authorizeUrl: string,
    tokenUrl: string,
    revokeUrl: string | null,
    introspectUrl: string | null,
    audienceRequired: boolean,
    refreshEnabled: boolean,
  ) {
    if (!await this.checkContextDuplicates(environmentId, context, !!revokeUrl, !!introspectUrl)) {
      throw new ConflictException(`Auth functions within context ${context} already exist`);
    }

    this.logger.debug(`Creating auth provider in environment ${environmentId} with context ${context} and authorizeUrl ${authorizeUrl}`);
    return this.prisma.authProvider.create({
      data: {
        name,
        context,
        authorizeUrl,
        tokenUrl,
        revokeUrl,
        introspectUrl,
        audienceRequired,
        refreshEnabled,
        environment: {
          connect: {
            id: environmentId,
          },
        },
      },
    });
  }

  async updateAuthProvider(
    authProvider: AuthProvider,
    name: string | undefined | null,
    context: string | undefined,
    authorizeUrl: string | undefined,
    tokenUrl: string | undefined,
    revokeUrl: string | null | undefined,
    introspectUrl: string | null | undefined,
    audienceRequired: boolean | undefined,
    refreshEnabled: boolean | undefined,
    visibility: Visibility | undefined,
  ) {
    context = context || authProvider.context;
    authorizeUrl = authorizeUrl || authProvider.authorizeUrl;
    tokenUrl = tokenUrl || authProvider.tokenUrl;
    revokeUrl = revokeUrl === undefined ? authProvider.revokeUrl : revokeUrl;
    introspectUrl = introspectUrl === undefined ? authProvider.introspectUrl : introspectUrl;
    audienceRequired = audienceRequired === undefined ? authProvider.audienceRequired : audienceRequired;
    refreshEnabled = refreshEnabled === undefined ? authProvider.refreshEnabled : refreshEnabled;
    visibility = visibility === undefined ? authProvider.visibility as Visibility : visibility;

    if (!await this.checkContextDuplicates(authProvider.environmentId, context, !!revokeUrl, !!introspectUrl, [authProvider.id])) {
      throw new ConflictException(`Auth functions within context ${context} already exist`);
    }

    this.logger.debug(`Updating auth provider ${authProvider.id}`);
    return this.prisma.authProvider.update({
      where: {
        id: authProvider.id,
      },
      data: {
        name,
        context,
        authorizeUrl,
        tokenUrl,
        revokeUrl,
        introspectUrl,
        audienceRequired,
        refreshEnabled,
        visibility,
      },
    });
  }

  async deleteAuthProvider(authProvider: AuthProvider) {
    this.logger.debug(`Deleting auth provider ${authProvider.id}`);
    return this.prisma.authProvider.delete({
      where: {
        id: authProvider.id,
      },
    });
  }

  toAuthProviderDto(authProvider: AuthProvider): AuthProviderDto {
    return {
      id: authProvider.id,
      name: authProvider.name,
      context: authProvider.context,
      authorizeUrl: authProvider.authorizeUrl,
      tokenUrl: authProvider.tokenUrl,
      audienceRequired: authProvider.audienceRequired,
      refreshEnabled: authProvider.refreshEnabled,
      revokeUrl: authProvider.revokeUrl,
      introspectUrl: authProvider.introspectUrl,
      callbackUrl: this.getAuthProviderCallbackUrl(authProvider),
      visibility: authProvider.visibility as Visibility,
    };
  }

  public async executeAuthProvider(authProvider: AuthProvider, eventsClientId: string, clientId: string, clientSecret: string, audience: string | null, scopes: string[], callbackUrl: string | null): Promise<ExecuteAuthProviderResponseDto> {
    this.logger.debug(`Executing auth provider ${authProvider.id}`);
    await this.prisma.authToken.deleteMany({
      where: {
        authProvider: {
          id: authProvider.id,
        },
        clientId,
        clientSecret,
        eventsClientId,
      },
    });

    const state = crypto.randomBytes(20).toString('hex');
    const authToken = await this.prisma.authToken.create({
      data: {
        authProvider: {
          connect: {
            id: authProvider.id,
          },
        },
        clientId,
        clientSecret,
        audience,
        scopes: scopes.join(' '),
        state,
        callbackUrl,
        eventsClientId,
      },
    });

    return {
      url: this.getAuthProviderAuthorizationUrl(authProvider, authToken),
    };
  }

  private getAuthProviderAuthorizationUrl(authProvider: AuthProvider, authToken: AuthToken) {
    const params = new URLSearchParams({
      client_id: authToken.clientId,
      redirect_uri: this.getAuthProviderCallbackUrl(authProvider),
      response_type: 'code',
    });

    if (authToken.state) {
      params.append('state', authToken.state);
    }
    if (authToken.scopes) {
      params.append('scope', authToken.scopes);
    }
    if (authToken.audience) {
      params.append('audience', authToken.audience);
    }

    return `${authProvider.authorizeUrl}?${params.toString()}`;
  }

  private getAuthProviderCallbackUrl(authProvider: AuthProvider) {
    return `${this.config.hostUrl}/auth-providers/${authProvider.id}/callback`;
  }

  async processAuthProviderCallback(id: string, query: any): Promise<string | null> {
    const { state, error, code } = query;
    if (!state) {
      this.logger.error('Missing state for auth provider callback');
      throw new BadRequestException('Missing state');
    }

    const authToken = await this.prisma.authToken.findFirst({
      where: {
        state,
      },
    });
    if (!authToken) {
      this.logger.error(`Cannot find auth token for state: ${state}`);
      throw new BadRequestException('Invalid state');
    }

    const authProvider = await this.prisma.authProvider.findFirst({
      where: {
        id,
      },
    });
    if (!authProvider) {
      this.logger.error(`Cannot find auth provider for id: ${id}`);
      throw new BadRequestException('Invalid id');
    }

    if (error) {
      this.logger.debug(`Auth function callback error: ${error}`);
      this.eventService.sendAuthFunctionEvent(id, authToken.eventsClientId, {
        error,
      });
      return null;
    }

    if (!code) {
      this.logger.error('Missing code for auth function callback');
      throw new BadRequestException('Missing code');
    }

    const tokenData = await lastValueFrom(
      this.httpService
        .request({
          url: authProvider.tokenUrl,
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          data: {
            code,
            client_id: authToken.clientId,
            client_secret: authToken.clientSecret,
            audience: authToken.audience,
            grant_type: 'authorization_code',
            redirect_uri: this.getAuthProviderCallbackUrl(authProvider),
          },
        })
        .pipe(
          map((response) => response.data),
        )
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Error while performing token request for auth function (id: ${authProvider.id}): ${error}`);

            this.eventService.sendAuthFunctionEvent(id, authToken.eventsClientId, {
              url: this.getAuthProviderAuthorizationUrl(authProvider, authToken),
              error: error.response ? error.response.data : error.message,
            });

            return of(null);
          }),
        ),
    );
    if (!tokenData) {
      return null;
    }

    this.logger.debug(`Received token data for auth function ${authProvider.id}: ${JSON.stringify(tokenData)}`);

    const updatedAuthToken = await this.prisma.authToken.update({
      where: {
        id: authToken.id,
      },
      data: {
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        state: crypto.randomBytes(20).toString('hex'),
      },
    });

    this.eventService.sendAuthFunctionEvent(id, updatedAuthToken.eventsClientId, {
      token: tokenData.access_token,
      url: this.getAuthProviderAuthorizationUrl(authProvider, updatedAuthToken),
    });

    return updatedAuthToken.callbackUrl;
  }

  async revokeAuthToken(authProvider: AuthProvider, token: string) {
    if (!authProvider.revokeUrl) {
      return;
    }

    this.logger.debug(`Revoking auth token for provider ${authProvider.id}...`);
    const authToken = await this.prisma.authToken.findFirst({
      where: {
        authProvider: {
          id: authProvider.id,
        },
        OR: [
          {
            accessToken: token,
          },
          {
            refreshToken: token,
          },
        ],
      },
    });
    if (authToken) {
      await this.prisma.authToken.deleteMany({
        where: {
          id: authToken.id,
        },
      });
    }

    if (!authToken?.accessToken) {
      this.logger.debug(`No auth token found for auth function ${authProvider.id}`);
      return;
    }

    await lastValueFrom(
      this.httpService
        .request({
          url: authProvider.revokeUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            client_id: authToken.clientId,
            client_secret: authToken.clientSecret,
            token: authToken.accessToken,
          },
        })
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Error while performing token revoke for auth function (id: ${authProvider.id}): ${error}`);
            throw new InternalServerErrorException(error.response?.data || error.message);
          }),
        ),
    );
  }

  async introspectAuthToken(authProvider: AuthProvider, token: string): Promise<any> {
    if (!authProvider.introspectUrl) {
      return;
    }

    this.logger.debug(`Introspecting auth token for provider ${authProvider.id}...`);
    return lastValueFrom(
      await this.httpService
        .request({
          url: authProvider.introspectUrl,
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          data: {
            token,
          },
        })
        .pipe(
          map((response) => {
            this.logger.debug(`Received introspection data for auth function ${authProvider.id}: ${JSON.stringify(response.data)}`);
            return response.data;
          }),
        )
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Error while performing token introspection for auth function (id: ${authProvider.id}): ${error}`);
            throw new InternalServerErrorException(error.response?.data || error.message);
          }),
        ),
    );
  }

  async refreshAuthToken(authProvider: AuthProvider, token: string): Promise<string> {
    if (!authProvider.refreshEnabled) {
      throw new BadRequestException('Refresh not enabled');
    }

    this.logger.debug(`Refreshing auth token for provider ${authProvider.id}...`);
    const authToken = await this.prisma.authToken.findFirst({
      where: {
        authProvider: {
          id: authProvider.id,
        },
        accessToken: token,
      },
    });
    if (!authToken?.refreshToken) {
      this.logger.debug(`No refresh token found for auth function ${authProvider.id}`);
      throw new BadRequestException(`No auth token found for auth function ${authProvider.id}`);
    }

    const { access_token: accessToken } = await lastValueFrom(
      await this.httpService
        .request({
          url: authProvider.tokenUrl,
          method: 'POST',
          headers: {
            Accept: 'application/json',
            'Content-Type': 'application/x-www-form-urlencoded',
          },
          data: {
            client_id: authToken.clientId,
            client_secret: authToken.clientSecret,
            audience: authToken.audience,
            grant_type: 'refresh_token',
            refresh_token: authToken.refreshToken,
          },
        })
        .pipe(
          map((response) => {
            this.logger.debug(`Received refreshed token data for auth function ${authProvider.id}: ${JSON.stringify(response.data)}`);
            return response.data;
          }),
        )
        .pipe(
          catchError((error: AxiosError) => {
            this.logger.error(`Error while performing token refresh for auth function (id: ${authProvider.id}): ${error}`);
            throw new InternalServerErrorException(error.response?.data || error.message);
          }),
        ),
    );

    await this.prisma.authToken.update({
      where: {
        id: authToken.id,
      },
      data: {
        accessToken,
      },
    });

    return accessToken;
  }

  async toAuthFunctionSpecifications(authProvider: AuthProvider, names: string[] = []): Promise<AuthFunctionSpecification[]> {
    const specifications: AuthFunctionSpecification[] = [];

    specifications.push({
      type: 'authFunction',
      id: authProvider.id,
      context: authProvider.context,
      name: 'getToken',
      description: `This function obtains a token${authProvider.name
        ? ` from ${authProvider.name}`
        : ''} using the OAuth 2.0 authorization code flow. It will return a login url if the user needs to log in, a token once they are logged in, and an error if the user fails to log in. It allows an optional callback url where the user is going to be redirected after log in.${authProvider.refreshEnabled
        ? ' If the refresh token flow is enabled, the refresh token will be stored on the poly server.'
        : ''}`,
      function: {
        arguments: this.getGetTokenFunctionArguments(authProvider),
        returnType: {
          kind: 'void',
        },
      },
      visibilityMetadata: {
        visibility: authProvider.visibility as Visibility,
      },
    });
    if (authProvider.introspectUrl) {
      specifications.push({
        type: 'authFunction',
        id: authProvider.id,
        context: authProvider.context,
        name: 'introspectToken',
        description: `This function should be used to introspect an access token${authProvider.name
          ? ` for ${authProvider.name}`
          : ''}. It will return a JSON with the claims of the token.`,
        function: {
          arguments: [
            {
              name: 'token',
              required: true,
              type: {
                kind: 'primitive',
                type: 'string',
              },
            },
          ],
          returnType: {
            kind: 'object',
          },
        },
        subResource: 'introspect',
        visibilityMetadata: {
          visibility: authProvider.visibility as Visibility,
        },
      });
    }
    if (authProvider.revokeUrl) {
      specifications.push({
        type: 'authFunction',
        id: authProvider.id,
        context: authProvider.context,
        name: 'revokeToken',
        description: `This function revokes both an access token and any associated refresh tokens${authProvider.name
          ? ` for ${authProvider.name}`
          : ''}.`,
        function: {
          arguments: [
            {
              name: 'token',
              required: true,
              type: {
                kind: 'primitive',
                type: 'string',
              },
            },
          ],
          returnType: {
            kind: 'void',
          },
        },
        subResource: 'revoke',
        visibilityMetadata: {
          visibility: authProvider.visibility as Visibility,
        },
      });
    }
    if (authProvider.refreshEnabled) {
      specifications.push({
        type: 'authFunction',
        id: authProvider.id,
        context: authProvider.context,
        name: 'refreshToken',
        description: `This function can be used to refresh an access token${authProvider.name
          ? ` for ${authProvider.name}`
          : ''}. In this case an access token, expired or not, can be passed in to refresh it for a new one. The refresh token to be used is stored on the poly server.`,
        function: {
          arguments: [
            {
              name: 'token',
              required: true,
              type: {
                kind: 'primitive',
                type: 'string',
              },
            },
          ],
          returnType: {
            kind: 'primitive',
            type: 'string',
          },
        },
        subResource: 'refresh',
        visibilityMetadata: {
          visibility: authProvider.visibility as Visibility,
        },
      });
    }

    if (names.length) {
      return specifications.filter(spec => names.includes(spec.name));
    }
    return specifications;
  }

  private getGetTokenFunctionArguments(authProvider: AuthProvider): PropertySpecification[] {
    return [
      {
        name: 'clientId',
        required: true,
        type: {
          kind: 'primitive',
          type: 'string',
        },
      },
      {
        name: 'clientSecret',
        required: true,
        type: {
          kind: 'primitive',
          type: 'string',
        },
      },
      authProvider.audienceRequired &&
      {
        name: 'audience',
        required: true,
        type: {
          kind: 'primitive',
          type: 'string',
        },
      },
      {
        name: 'scopes',
        required: true,
        type: {
          kind: 'array',
          items: {
            kind: 'primitive',
            type: 'string',
          },
        },
      },
      {
        name: 'callback',
        required: true,
        type: {
          kind: 'function',
          name: 'AuthFunctionCallback',
          spec: {
            arguments: [
              {
                name: 'token',
                required: false,
                nullable: true,
                type: {
                  kind: 'primitive',
                  type: 'string',
                },
              },
              {
                name: 'url',
                required: false,
                type: {
                  kind: 'primitive',
                  type: 'string',
                },
              },
              {
                name: 'error',
                required: false,
                nullable: true,
                type: {
                  kind: 'primitive',
                  type: 'object',
                },
              },
            ],
            returnType: {
              kind: 'void',
            },
            synchronous: true,
          },
        },
      },
      {
        name: 'options',
        required: false,
        type: {
          kind: 'object',
          properties: [
            {
              name: 'callbackUrl',
              required: false,
              type: {
                kind: 'primitive',
                type: 'string',
              },
            },
            {
              name: 'timeout',
              required: false,
              type: {
                kind: 'primitive',
                type: 'number',
              },
            },
            !authProvider.audienceRequired &&
            {
              name: 'audience',
              required: false,
              type: {
                kind: 'primitive',
                type: 'string',
              },
            },
            {
              name: 'autoCloseOnToken',
              required: false,
              type: {
                kind: 'primitive',
                type: 'boolean',
              },
            },
            {
              name: 'userId',
              required: false,
              type: {
                kind: 'primitive',
                type: 'string',
              },
            },
          ].filter(Boolean),
        },
      },
    ].filter(Boolean) as PropertySpecification[];
  }

  private async checkContextDuplicates(environmentId: string, context: string, revokeFunction: boolean, introspectFunction: boolean, excludedIds?: string[]): Promise<boolean> {
    const paths = (await this.specsService.getSpecificationPaths(environmentId))
      .filter(path => excludedIds == null || !excludedIds.includes(path.id))
      .map(path => path.path);

    if (paths.includes(`${context}.getToken`)) {
      return false;
    }
    if (revokeFunction && paths.includes(`${context}.revokeToken`)) {
      return false;
    }
    if (introspectFunction && paths.includes(`${context}.introspectToken`)) {
      return false;
    }

    return true;
  }
}

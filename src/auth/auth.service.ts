import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { AuthData } from 'common/types';
import { ApiKeyDto, Permission, Permissions, Role, Visibility } from '@poly/model';
import { ApiKey, Application, Environment, Tenant, User } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import crypto from 'crypto';
import _ from 'lodash';

type ApiKeyWithUser = ApiKey & { user: User | null };

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(private readonly prisma: PrismaService) {}

  toApiKeyDto(apiKey: ApiKeyWithUser): ApiKeyDto {
    return {
      id: apiKey.id,
      name: apiKey.name,
      environmentId: apiKey.environmentId,
      key: apiKey.key,
      applicationId: apiKey.applicationId,
      userId: apiKey.userId,
      permissions: this.fillPermissions(JSON.parse(apiKey.permissions), apiKey.user),
    };
  }

  async getAllApiKeys(environmentId: string): Promise<ApiKeyWithUser[]> {
    return this.prisma.apiKey.findMany({
      where: {
        environmentId,
      },
      include: {
        user: true,
      },
    });
  }

  async findApiKeyById(id: string, includeEnvironment = false) {
    return this.prisma.apiKey.findFirst({
      where: {
        id,
      },
      include: {
        environment: includeEnvironment,
        user: true,
      },
    });
  }

  async findApiKeyByKey(key: string, includeEnvironment = false, includeApplication = false, includeUser = false) {
    return this.prisma.apiKey.findFirst({
      where: {
        key,
      },
      include: {
        application: includeApplication,
        user: includeUser,
        environment: includeEnvironment
          ? {
              include: {
                tenant: true,
              },
            }
          : false,
      },
    });
  }

  async createApiKey(
    environmentId: string,
    name: string,
    application: Application | null,
    user: User | null,
    permissions?: Permissions,
  ): Promise<
    ApiKey & {
      user: User | null;
    }
  > {
    return this.prisma.apiKey.create({
      data: {
        environmentId,
        name,
        key: crypto.randomUUID(),
        userId: user ? user.id : null,
        applicationId: application ? application.id : null,
        permissions: JSON.stringify(
          this.pickPermissions(permissions || this.getDefaultApiKeyPermissions(application, user)),
        ),
      },
      include: {
        user: true,
      },
    });
  }

  async updateApiKey(apiKey: ApiKey, name?: string, permissions?: Permissions): Promise<ApiKeyWithUser> {
    return this.prisma.apiKey.update({
      where: {
        id: apiKey.id,
      },
      data: {
        name: name || apiKey.name,
        permissions: JSON.stringify({
          ...JSON.parse(apiKey.permissions),
          ...this.pickPermissions(permissions || {}),
        }),
      },
      include: {
        user: true,
      },
    });
  }

  async deleteApiKey(id: string) {
    return this.prisma.apiKey.delete({
      where: {
        id,
      },
    });
  }

  private getDefaultApiKeyPermissions(application: Application | null, user: User | null): Permissions {
    if (application) {
      return {
        [Permission.Use]: true,
      };
    } else if (user) {
      switch (user.role) {
        case Role.User: {
          return {
            [Permission.Use]: true,
          };
        }
      }
    }

    return {};
  }

  private pickPermissions(permissions: Permissions) {
    return _.pick(permissions, Object.values(Permission));
  }

  private fillPermissions(permissions: Permissions, user: User | null) {
    const isAdmin = user?.role === Role.SuperAdmin || user?.role === Role.Admin;

    return Object.values(Permission).reduce(
      (acc, permission) => ({
        ...acc,
        [permission]: isAdmin || permissions[permission] === true,
      }),
      {} as Permissions,
    );
  }

  public async checkTenantAccess(tenantId: string, authData: AuthData, roles?: Role[], ...permissions: Permission[]) {
    const { tenant, user } = authData;
    if (user?.role === Role.SuperAdmin) {
      return true;
    }
    if (tenant.id !== tenantId) {
      throw new ForbiddenException('You do not have access to this entity');
    }

    if (roles && (!user || !roles.includes(user.role as Role))) {
      throw new ForbiddenException('You do not have access to this entity');
    }

    await this.checkPermissions(authData, ...permissions);

    return true;
  }

  public async checkEnvironmentEntityAccess(
    environmentEntity: { environmentId: string; visibility: string },
    authData: AuthData,
    checkVisibility = false,
    ...permissions: Permission[]
  ) {
    const { environment, user } = authData;

    if (user?.role === Role.SuperAdmin) {
      return true;
    }

    const environmentsNotMatch = environment.id !== environmentEntity.environmentId;

    if (
      (checkVisibility && environmentEntity.visibility !== Visibility.Public && environmentsNotMatch) ||
      (!checkVisibility && environmentsNotMatch)
    ) {
      throw new ForbiddenException('You do not have access to this entity');
    }

    await this.checkPermissions(authData, ...permissions);

    return true;
  }

  async checkPermissions({ user, permissions }: AuthData, ...permissionsToCheck: Permission[]) {
    if (!permissionsToCheck.length) {
      return true;
    }

    if (user?.role === Role.SuperAdmin || user?.role === Role.Admin) {
      return true;
    }

    permissionsToCheck.forEach((permission) => {
      if (!permissions[permission]) {
        throw new ForbiddenException(`Missing '${permission}' permission`);
      }
    });
  }

  async getAuthData(key: string): Promise<AuthData | null> {
    const apiKey = await this.findApiKeyByKey(key, true, true, true);
    if (!apiKey) {
      return null;
    }

    const environment: Environment & { tenant: Tenant } = apiKey.environment as Environment & { tenant: Tenant };
    const tenant = environment.tenant;
    const application = apiKey.application;
    const user = apiKey.user;

    return {
      key,
      tenant,
      environment,
      application,
      user,
      permissions: this.fillPermissions(JSON.parse(apiKey.permissions), user),
    } as AuthData;
  }
}

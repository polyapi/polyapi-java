import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { AuthData } from 'common/types';
import { Permission, Permissions, Role } from '@poly/common';
import { Environment, Tenant, User } from '@prisma/client';
import { TenantService } from 'tenant/tenant.service';
import { EnvironmentService } from 'environment/environment.service';
import { UserService } from 'user/user.service';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly userService: UserService,
    private readonly tenantService: TenantService,
    private readonly environmentService: EnvironmentService,
  ) {
  }

  public async checkTenantAccess(
    tenantId: string,
    authData: AuthData,
    roles?: Role[],
    ...permissions: Permission[]
  ) {
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
    environmentEntity: { environmentId: string },
    authData: AuthData,
    ...permissions: Permission[]
  ) {
    const { environment, user} = authData;

    if (user?.role === Role.SuperAdmin) {
      return true;
    }

    if (environment.id !== environmentEntity.environmentId) {
      throw new ForbiddenException('You do not have access to this entity');
    }

    await this.checkPermissions(authData, ...permissions);

    return true;
  }

  async checkPermissions({ user, userKey }: AuthData, ...permissions: Permission[]) {
    if (!permissions.length) {
      return true;
    }
    if (!userKey) {
      // not restricted by user permissions
      return true;
    }

    if (user?.role === Role.SuperAdmin || user?.role === Role.Admin) {
      return true;
    }

    const userPermissions = JSON.parse(userKey.permissions) as Permissions;
    permissions.forEach(permission => {
      if (!userPermissions[permission]) {
        throw new ForbiddenException(`Missing '${permission}' permission`);
      }
    });
  }

  async getAuthData(polyKey: string) {
    let user: User | null = null;
    let environment: Environment & { tenant: Tenant } | null = null;

    const userKey = await this.userService.findUserKeyById(polyKey, true, true);
    if (userKey) {
      environment = userKey.environment as Environment & { tenant: Tenant };
      user = userKey.user;
      if (!user) {
        this.logger.error(`User key ${polyKey} has no valid user`);
        return null;
      }
      if (!environment) {
        this.logger.error(`User key ${polyKey} has no valid environment`);
        return null;
      }
    }

    if (!environment) {
      environment = await this.environmentService.findByKey(polyKey);
    }
    if (!environment) {
      this.logger.error(`Key ${polyKey} has no valid environment`);
      return null;
    }

    // valid key
    return {
      tenant: environment.tenant,
      environment,
      user,
      userKey,
    } as AuthData;
  }
}

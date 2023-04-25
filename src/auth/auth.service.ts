import { ForbiddenException, Injectable, Logger } from '@nestjs/common';
import { AuthData } from 'common/types';
import { Role } from '@poly/common';
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
    { tenant, user }: AuthData,
    roles?: Role[],
  ) {
    if (user?.role === Role.SuperAdmin) {
      return true;
    }
    if (tenant.id !== tenantId) {
      throw new ForbiddenException('You do not have access to this entity');
    }

    if (roles && (!user || !roles.includes(user.role as Role))) {
      throw new ForbiddenException('You do not have access to this entity');
    }

    return true;
  }

  public async checkEnvironmentEntityAccess(
    environmentEntity: { environmentId: string },
    { environment, user, userKey }: AuthData,
    // TODO: add permissions to check
  ) {
    if (environment?.id === environmentEntity.environmentId) {
      return true;
    }
    if (user?.role === Role.SuperAdmin) {
      return true;
    }
    if (userKey?.environmentId === environmentEntity.environmentId) {
      return true;
    }

    throw new ForbiddenException('You do not have access to this entity');
  }

  async getAuthData(polyKey: string) {
    let user: User | null = null;
    let environment: Environment & {tenant: Tenant} | null = null;

    const userKey = await this.userService.findUserKey(polyKey);
    if (userKey) {
      environment = await this.environmentService.findById(userKey.environmentId);
      user = await this.userService.findById(userKey.userId);
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
      userKey
    } as AuthData;
  }
}

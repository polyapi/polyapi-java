import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Tenant } from '@prisma/client';
import { ConfigService } from 'config/config.service';
import { EnvironmentService } from 'environment/environment.service';
import { TeamService } from 'team/team.service';
import { UserService } from 'user/user.service';
import { Role, TenantDto, TenantFullDto } from '@poly/common';
import crypto from 'crypto';

type CreateTenantDefaults = {
  environmentName?: string;
  environmentAppKey?: string;
  teamName?: string;
  userName?: string;
  userRole?: Role;
  userKey?: string;
}

@Injectable()
export class TenantService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly environmentService: EnvironmentService,
    private readonly teamService: TeamService,
    private readonly userService: UserService,
  ) {
  }

  async onModuleInit() {
    return this.checkPolyTenant();
  }

  private async checkPolyTenant() {
    const tenant = await this.findByName(this.config.polyTenantName);
    if (!tenant) {
      await this.create(this.config.polyTenantName, {
        teamName: this.config.polyAdminsTeamName,
        userName: this.config.polyAdminUserName,
        userRole: Role.SuperAdmin,
        userKey: this.config.polySuperAdminUserKey,
      });
    }
  }

  toDto(tenant: Tenant): TenantDto {
    return {
      id: tenant.id,
      name: tenant.name,
    };
  }

  async toFullDto(tenant: Tenant): Promise<TenantFullDto> {
    const fullTenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenant.id,
      },
      include: {
        environments: true,
        teams: {
          include: {
            users: {
              include: {
                userKeys: true,
              },
            },
          },
        },
      },
    });
    if (!fullTenant) {
      throw new Error(`Tenant ${tenant.id} not found`);
    }

    const toUserFullDto = user => ({
      ...this.userService.toUserDto(user),
      userKeys: user.userKeys.map(userKey => this.userService.toUserKeyDto(userKey)),
    });
    const toTeamFullDto = team => ({
      ...this.teamService.toDto(team),
      users: team.users.map(toUserFullDto),
    });
    return {
      id: fullTenant.id,
      name: fullTenant.name,
      environments: fullTenant.environments?.map(environment => this.environmentService.toDto(environment)),
      teams: fullTenant.teams.map(toTeamFullDto),
    };
  }

  async getAll() {
    return this.prisma.tenant.findMany();
  }

  async findById(id: string) {
    return this.prisma.tenant.findFirst({
      where: {
        id,
      },
    });
  }

  async create(name: string, defaults: CreateTenantDefaults = {}): Promise<Tenant> {
    const { environmentName, environmentAppKey, teamName, userName, userRole, userKey } = defaults;

    return this.prisma.$transaction(async tx => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          environments: {
            create: [
              {
                name: environmentName || 'default',
                appKey: environmentAppKey || this.environmentService.generateAppKey(),
                subdomain: this.environmentService.generateSubdomainID(),
              },
            ],
          },
          teams: {
            create: [
              {
                name: teamName || 'default',
                users: {
                  create: [
                    {
                      name: userName || 'admin',
                      role: userRole || Role.Admin,
                    },
                  ],
                },
              },
            ],
          },
        },
        include: {
          environments: true,
          teams: {
            include: {
              users: true,
            },
          },
        },
      });

      await tx.userKey.create({
        data: {
          key: userKey || crypto.randomUUID(),
          user: {
            connect: {
              id: tenant.teams[0].users[0].id,
            },
          },
          environment: {
            connect: {
              id: tenant.environments[0].id,
            },
          },
        },
      });

      return tenant;
    });
  }

  async update(tenant: Tenant, name: string) {
    return this.prisma.tenant.update({
      where: {
        id: tenant.id,
      },
      data: {
        name,
      },
    });
  }

  async delete(tenant: Tenant) {
    return this.prisma.tenant.delete({
      where: {
        id: tenant.id,
      },
    });
  }

  async findByName(name: string): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({
      where: {
        name,
      },
    });
  }

  async getByEnvironment(environmentId: string) {
    const tenant = await this.prisma.tenant.findFirst({
      where: {
        environments: {
          some: {
            id: environmentId,
          },
        },
      },
    });
    if (!tenant) {
      throw new Error(`Tenant not found for environment ${environmentId}`);
    }
    return tenant;
  }
}

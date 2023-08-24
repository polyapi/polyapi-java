import { ConflictException, Injectable, OnModuleInit } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { ApiKey, Tenant, TenantSignUp } from '@prisma/client';
import { ConfigService } from 'config/config.service';
import { EnvironmentService } from 'environment/environment.service';
import { TeamService } from 'team/team.service';
import { UserService } from 'user/user.service';
import { Role, SignUpDto, SignUpVerificationResultDto, TenantDto, TenantFullDto } from '@poly/model';
import crypto from 'crypto';
import { ApplicationService } from 'application/application.service';
import { AuthService } from 'auth/auth.service';
import { getEndOfDay } from '@poly/common/utils';

type CreateTenantOptions = {
  environmentName?: string;
  teamName?: string;
  userName?: string;
  userRole?: Role;
  userApiKey?: string;
  email?: string;
}

@Injectable()
export class TenantService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly environmentService: EnvironmentService,
    private readonly applicationService: ApplicationService,
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
      await this.create(this.config.polyTenantName, true, null, {
        teamName: this.config.polyAdminsTeamName,
        userName: this.config.polyAdminUserName,
        userRole: Role.SuperAdmin,
        userApiKey: this.config.polySuperAdminUserKey,
      });
    }
  }

  toDto(tenant: Tenant): TenantDto {
    return {
      id: tenant.id,
      name: tenant.name,
      publicVisibilityAllowed: tenant.publicVisibilityAllowed,
      limitTierId: tenant.limitTierId,
    };
  }

  async toFullDto(tenant: Tenant): Promise<TenantFullDto> {
    const fullTenant = await this.prisma.tenant.findUnique({
      where: {
        id: tenant.id,
      },
      include: {
        users: true,
        environments: {
          include: {
            apiKeys: {
              include: {
                user: true,
              },
            },
          },
        },
        applications: true,
        teams: {
          include: {
            teamMembers: {
              include: {
                user: true,
              },
            },
          },
        },
      },
    });
    if (!fullTenant) {
      throw new Error(`Tenant ${tenant.id} not found`);
    }

    const toEnvironmentFullDto = environment => ({
      ...this.environmentService.toDto(environment),
      apiKeys: environment.apiKeys.map(apiKey => this.authService.toApiKeyDto(apiKey)),
    });
    const toTeamFullDto = team => ({
      ...this.teamService.toTeamDto(team),
      members: team.teamMembers.map(member => this.teamService.toMemberDto(member)),
    });
    return {
      id: fullTenant.id,
      name: fullTenant.name,
      publicVisibilityAllowed: fullTenant.publicVisibilityAllowed,
      limitTierId: fullTenant.limitTierId,
      users: fullTenant.users.map(user => this.userService.toUserDto(user)),
      environments: fullTenant.environments.map(toEnvironmentFullDto),
      applications: fullTenant.applications.map(application => this.applicationService.toApplicationDto(application)),
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

  async create(name: string, publicVisibilityAllowed = false, limitTierId: string | null = null, options: CreateTenantOptions = {}): Promise<{
    tenant: Tenant,
    apiKey: ApiKey
  }> {
    const { environmentName, teamName, userName, userRole, userApiKey, email = null } = options;

    return this.prisma.$transaction(async tx => {
      const tenant = await tx.tenant.create({
        data: {
          name,
          publicVisibilityAllowed,
          limitTierId,
          users: {
            create: [
              {
                name: userName || 'admin',
                role: userRole || Role.Admin,
                email,
              },
            ],
          },
          environments: {
            create: [
              {
                name: environmentName || 'default',
                subdomain: this.environmentService.generateSubdomainID(),
              },
            ],
          },
          teams: {
            create: [
              {
                name: teamName || 'default',
              },
            ],
          },
        },
        include: {
          users: true,
          environments: true,
          teams: true,
        },
      });

      // add user to team
      await tx.teamMember.create({
        data: {
          team: {
            connect: {
              id: tenant.teams[0].id,
            },
          },
          user: {
            connect: {
              id: tenant.users[0].id,
            },
          },
        },
      });

      // create API key for user
      const apiKey = await tx.apiKey.create({
        data: {
          name: `api-key-${userRole || Role.Admin}`,
          key: userApiKey || crypto.randomUUID(),
          user: {
            connect: {
              id: tenant.users[0].id,
            },
          },
          environment: {
            connect: {
              id: tenant.environments[0].id,
            },
          },
        },
      });

      return {
        tenant,
        apiKey,
      };
    });
  }

  async update(tenant: Tenant, name: string | undefined, publicVisibilityAllowed: boolean | undefined, limitTierId: string | null | undefined) {
    return this.prisma.tenant.update({
      where: {
        id: tenant.id,
      },
      data: {
        name,
        publicVisibilityAllowed,
        limitTierId,
      },
    });
  }

  async delete(tenantId: string) {
    await this.environmentService.deleteAllByTenant(tenantId);

    return this.prisma.tenant.delete({
      where: {
        id: tenantId,
      },
    });
  }

  toSignUpDto(tenantSignUp: TenantSignUp): SignUpDto {
    return {
      id: tenantSignUp.id,
      email: tenantSignUp.email,
      name: tenantSignUp.name,
    };
  }

  private createSignUpVerfificationCode() {
    return Math.random().toString(36).slice(2, 8);
  }

  private async createSignUpRecord(email: string, name: string) {
    try {
      return await this.prisma.tenantSignUp.create({
        data: {
          email,
          verificationCode: this.createSignUpVerfificationCode(),
          name,
          expiresAt: getEndOfDay(),
        },
      });
    } catch (err) {
      // Verification code collision.
      if (err.code === 'P2002' && Array.isArray(err.meta.target) && err.meta.target.includes('verificationCode')) {
        return await this.createSignUpRecord(email, name);
      }
      throw err;
    }
  }

  async signUp(email: string, name: string) {
    const [user, tenantSignUp] = await Promise.all([
      this.prisma.user.findFirst({
        where: {
          email,
        },
      }),
      this.prisma.tenantSignUp.findFirst({
        where: {
          email,
        },
      }),
    ]);

    if (tenantSignUp) {
      if (tenantSignUp.expiresAt < new Date()) {
        // Update and send new verification code.

        return this.prisma.tenantSignUp.update({
          where: {
            id: tenantSignUp.id,
          },
          data: {
            expiresAt: getEndOfDay(),
          },
        });
      }

      return tenantSignUp;
    }

    if (user) {
      throw new ConflictException('Email already exists.');
    }

    return this.createSignUpRecord(email, name);
  }

  async signUpVerify(id: string, code: string): Promise<SignUpVerificationResultDto> {
    const [tenantSignUp, tier] = await Promise.all([
      this.prisma.tenantSignUp.findFirst({
        where: {
          id,
          verificationCode: code.toLowerCase(),
        },
      }),
      this.prisma.limitTier.findFirst({
        where: {
          name: 'free',
        },
      }),
    ]);

    if (!tenantSignUp) {
      throw new ConflictException({ code: 'INVALID_VERIFICATION_CODE' });
    }

    if (tenantSignUp.expiresAt < new Date()) {
      await this.resendVerificationCode(id);
      throw new ConflictException({ code: 'EXPIRED_VERIFICATION_CODE' });
    }

    const {
      apiKey,
    } = await this.create(tenantSignUp.name, false, tier?.id, { email: tenantSignUp.email });

    await this.prisma.tenantSignUp.delete({
      where: {
        id,
      },
    });

    return {
      apiKey: apiKey.key,
      apiBaseUrl: this.config.hostUrl,
    };
  }

  async resendVerificationCode(id: string) {
    await this.prisma.$transaction(async tx => {
      await tx.tenantSignUp.update({
        where: {
          id,
        },
        data: {
          verificationCode: this.createSignUpVerfificationCode(),
        },
      });

      // Send code through email service.
    });
  }

  private async findByName(name: string): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({
      where: {
        name,
      },
    });
  }
}

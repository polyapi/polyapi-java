import { ConflictException, Injectable, Logger, NotFoundException, OnModuleInit } from '@nestjs/common';
import { PrismaService, PrismaTransaction } from 'prisma/prisma.service';
import { ApiKey, Tenant, TenantAgreement, TenantSignUp, Tos } from '@prisma/client';
import { ConfigService } from 'config/config.service';
import { EnvironmentService } from 'environment/environment.service';
import { TeamService } from 'team/team.service';
import { UserService } from 'user/user.service';
import { Role, SignUpDto, SignUpVerificationResultDto, TenantAgreementDto, TenantDto, TenantFullDto } from '@poly/model';
import crypto from 'crypto';
import { ApplicationService } from 'application/application.service';
import { AuthService } from 'auth/auth.service';
import { getEndOfDay } from '@poly/common/utils';
import { EmailService } from 'email/email.service';
import { CommonService } from 'common/common.service';

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
  private readonly logger = new Logger(TenantService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly authService: AuthService,
    private readonly environmentService: EnvironmentService,
    private readonly applicationService: ApplicationService,
    private readonly teamService: TeamService,
    private readonly userService: UserService,
    private readonly emailService: EmailService,
    private readonly commonService: CommonService,
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
      tierId: tenant.limitTierId,
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
      tierId: fullTenant.limitTierId,
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

  async create(name: string, publicVisibilityAllowed = false, limitTierId: string | null = null, options: CreateTenantOptions = {}) {
    return this.prisma.$transaction(async tx => {
      return this.createTenantRecord(tx, name, publicVisibilityAllowed, limitTierId, options);
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

  // crear tenant agreement dto
  toTenantAgreementDto(tenantAgreement: TenantAgreement & { tos: Tos }): TenantAgreementDto {
    return {
      tosId: tenantAgreement.tos.id,
      agreedAt: tenantAgreement.agreedAt,
      email: tenantAgreement.email,
      version: tenantAgreement.tos.version,
      notes: tenantAgreement.notes || '',
    };
  }

  private createSignUpVerfificationCode() {
    return Math.random().toString(36).slice(2, 8);
  }

  async signUp(email: string, tenantName: string | null) {
    const [user, tenantSignUp, foundTenantSignUpByName, tenant] = await Promise.all([
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
      tenantName
        ? this.prisma.tenantSignUp.findFirst({
          where: {
            name: tenantName,
          },
        })
        : null,
      tenantName
        ? this.prisma.tenant.findFirst({
          where: {
            name: tenantName,
          },
        })
        : null,
    ]);

    if (foundTenantSignUpByName || tenant) {
      throw new ConflictException({
        code: 'TENANT_ALREADY_EXISTS',
      });
    }

    if (user) {
      throw new ConflictException({
        code: 'EMAIL_ALREADY_EXISTS',
      });
    }

    if (tenantSignUp) {
      if (tenantSignUp.expiresAt < new Date()) {
        return this.updateAndResendVerificationCode(tenantSignUp.id, tenantName);
      }

      return this.prisma.tenantSignUp.update({
        where: {
          id: tenantSignUp.id,
        },
        data: {
          name: tenantName || undefined,
        },
      });
    }

    return this.createSignUpRecord(email, tenantName);
  }

  async signUpVerify(id: string, code: string, tosId: string): Promise<SignUpVerificationResultDto> {
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
      await this.updateAndResendVerificationCode(id);
      throw new ConflictException({ code: 'EXPIRED_VERIFICATION_CODE' });
    }

    return this.prisma.$transaction(async tx => {
      const {
        apiKey,
        tenant,
      } = await this.createTenantRecord(tx, tenantSignUp.name, false, tier?.id, { email: tenantSignUp.email });

      await tx.tenantAgreement.create({
        data: {
          tosId,
          email: tenantSignUp.email,
          tenantId: tenant.id,
        },
      });

      await tx.tenantSignUp.delete({
        where: {
          id,
        },
      });

      await this.emailService.send(this.config.signUpEmail, 'Poly API Tenant Information', `URL: ${this.config.hostUrl}\nPoly Api Key: ${apiKey.key}\nTenant ID: ${tenant.id}`, tenantSignUp.email);

      return {
        apiKey: apiKey.key,
        apiBaseUrl: this.config.hostUrl,
        tenantId: tenant.id,
      };
    });
  }

  async resendVerificationCode(id: string) {
    return this.updateAndResendVerificationCode(id);
  }

  async getTenantAgreements(tenantId: string) {
    const agreements = await this.prisma.tenantAgreement.findMany({
      where: {
        tenantId,
      },
      include: {
        tos: true,
      },
      orderBy: [
        {
          agreedAt: 'desc',
        },
      ],
    });

    return agreements;
  }

  async createTenantAgreement(tenantId: string, tosId: string, email: string, agreedAt?: Date, notes?: string) {
    return this.prisma.tenantAgreement.create({
      data: {
        tosId,
        tenantId,
        agreedAt: agreedAt ?? new Date(),
        notes,
        email,
      },
      include: {
        tos: true,
      },
    });
  }

  async verifyAvailability(email: string, tenantName: string) {
    if (email) {
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

      if (user || tenantSignUp) {
        throw new ConflictException({
          code: 'EMAIL_ALREADY_EXISTS',
        });
      }
    }
    if (tenantName) {
      const tenant = await this.prisma.tenant.findFirst({
        where: {
          name: tenantName,
        },
      });

      if (tenant) {
        throw new ConflictException({
          code: 'TENANT_ALREADY_EXISTS',
        });
      }
    }
  }

  private async createTenantRecord(tx: PrismaTransaction, name: string | null, publicVisibilityAllowed = false, limitTierId: string | null = null, options: CreateTenantOptions = {}): Promise<{
    tenant: Tenant,
    apiKey: ApiKey
  }> {
    const { environmentName, teamName, userName, userRole, userApiKey, email = null } = options;
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
  }

  private async updateAndResendVerificationCode(id: string, name: string | null = null): Promise<TenantSignUp> {
    const result = await this.prisma.$transaction(async tx => {
      const tenantSignUp = await tx.tenantSignUp.findFirst({
        where: {
          id,
        },
      });

      if (!tenantSignUp) {
        throw new NotFoundException('Tenant sign up not found.');
      }

      const verificationCode = this.createSignUpVerfificationCode();

      try {
        const tenantSignUp = await tx.tenantSignUp.update({
          where: {
            id,
          },
          data: {
            verificationCode,
            expiresAt: getEndOfDay(),
            name: name || undefined,
          },
        });

        await this.sendSignUpVerificationCode(verificationCode, tenantSignUp);

        return tenantSignUp;
      } catch (error) {
        if (this.commonService.isPrismaUniqueConstraintFailedError(error, 'verification_code')) {
          this.logger.debug(`Duplicated verification code "${verificationCode}", retrying...`);
          return false;
        }
        throw error;
      }
    });

    if (!result) {
      return this.updateAndResendVerificationCode(id);
    }

    return result;
  }

  private async findByName(name: string): Promise<Tenant | null> {
    return this.prisma.tenant.findFirst({
      where: {
        name,
      },
    });
  }

  private async createSignUpRecord(email: string, name: string | null): Promise<TenantSignUp> {
    const verificationCode = this.createSignUpVerfificationCode();

    const result = await this.prisma.$transaction(async tx => {
      try {
        const tenantSignUp = await tx.tenantSignUp.create({
          data: {
            email,
            verificationCode,
            name,
            expiresAt: getEndOfDay(),
          },
        });

        await this.sendSignUpVerificationCode(verificationCode, tenantSignUp);

        return tenantSignUp;
      } catch (error) {
        if (this.commonService.isPrismaUniqueConstraintFailedError(error, 'verification_code')) {
          this.logger.debug(`Duplicated verification code "${verificationCode}", retrying...`);
          return false;
        }
        throw error;
      }
    });

    if (!result) {
      return this.createSignUpRecord(email, name);
    }

    return result;
  }

  private sendSignUpVerificationCode(verificationCode: string, tenantSignUp: TenantSignUp) {
    return this.emailService.send(this.config.signUpEmail, 'Poly API Verification Code', `Verification Code: ${verificationCode.toUpperCase()}`, tenantSignUp.email);
  }
}

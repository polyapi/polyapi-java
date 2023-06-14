import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Role, UserDto } from '@poly/common';
import { User } from '@prisma/client';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(private readonly prisma: PrismaService) {
  }

  toUserDto(user: User): UserDto {
    return {
      id: user.id,
      name: user.name,
      role: user.role as Role,
    };
  }

  async getAllUsersByTenant(tenantId: string) {
    return this.prisma.user.findMany({
      where: {
        tenantId,
      },
    });
  }

  async findUserById(id: string) {
    return this.prisma.user.findFirst({
      where: {
        id,
      },
    });
  }

  async findAdminUserByEnvironmentId(environmentId: string) {
    return this.prisma.user.findFirst({
      where: {
        tenant: {
          environments: {
            some: {
              id: environmentId,
            },
          },
        },
        role: {
          in: [Role.SuperAdmin, Role.Admin],
        },
      },
    });
  }

  async createUser(tenantId: string, name: string, role: Role) {
    this.logger.debug(`Creating user ${name} with role ${role}...`);
    return this.prisma.user.create({
      data: {
        tenant: {
          connect: {
            id: tenantId,
          },
        },
        name,
        role,
      },
    });
  }

  async updateUser(user: User, name: string | undefined, role: Role | undefined) {
    this.logger.debug(`Updating user ${user.id}...`);
    return this.prisma.user.update({
      where: {
        id: user.id,
      },
      data: {
        name,
        role,
      },
    });
  }

  async deleteUser(id: string) {
    this.logger.debug(`Deleting user ${id}...`);
    return this.prisma.user.delete({
      where: {
        id,
      },
    });
  }
}

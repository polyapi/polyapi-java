import crypto from 'crypto';
import _ from 'lodash';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Permission, Permissions, Role, UserDto, UserKeyDto } from '@poly/common';
import { User, UserKey } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {
  }

  toUserDto(user: User): UserDto {
    return {
      id: user.id,
      name: user.name,
      role: user.role as Role,
    };
  }

  toUserKeyDto(userKey: UserKey): UserKeyDto {
    return {
      id: userKey.id,
      environmentId: userKey.environmentId,
      key: userKey.key,
      permissions: this.fillPermissions(JSON.parse(userKey.permissions)),
    };
  }

  async getAllUsersByTeam(teamId: string) {
    return this.prisma.user.findMany({
      where: {
        teamId,
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
        team: {
          tenant: {
            environments: {
              some: {
                id: environmentId,
              },
            },
          },
        },
        role: {
          in: [Role.SuperAdmin, Role.Admin],
        },
      },
    });
  }

  async createUser(teamId: string, name: string, role: Role) {
    return this.prisma.user.create({
      data: {
        team: {
          connect: {
            id: teamId,
          },
        },
        name,
        role,
      },
    });
  }

  async updateUser(user: User, name: string | undefined, role: Role | undefined) {
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
    this.prisma.user.delete({
      where: {
        id,
      },
    });
  }

  async getAllUserKeys(userId: string) {
    return this.prisma.userKey.findMany({
      where: {
        userId,
      },
    });
  }

  async findUserKeyById(userKey: string, includeUser = false, includeEnvironment = false) {
    return this.prisma.userKey.findFirst({
      where: {
        key: userKey,
      },
      include: {
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

  async createOrUpdateUserKey(user: User, environmentId: string, permissions?: Permissions) {
    if (!permissions) {
      permissions = this.getDefaultUserKeyPermissions(user.role as Role);
    }

    return this.prisma.userKey.upsert({
      where: {
        userId_environmentId: {
          userId: user.id,
          environmentId,
        },
      },
      create: {
        key: crypto.randomUUID(),
        environment: {
          connect: {
            id: environmentId,
          },
        },
        user: {
          connect: {
            id: user.id,
          },
        },
        permissions: JSON.stringify(this.pickPermissions(permissions)),
      },
      update: {
        permissions: JSON.stringify(this.pickPermissions(permissions)),
      },
    });
  }

  private getDefaultUserKeyPermissions(role: Role): Permissions {
    switch (role) {
      case Role.User:
        return {
          use: true,
        };
      default:
        return {};
    }
  }

  async updateUserKey(userKey: UserKey, permissions: Permissions) {
    return this.prisma.userKey.update({
      where: {
        id: userKey.id,
      },
      data: {
        permissions: JSON.stringify({
          ...JSON.parse(userKey.permissions),
          ...this.pickPermissions(permissions),
        }),
      },
    });
  }

  async deleteUserKey(id: string) {
    this.prisma.userKey.delete({
      where: {
        id,
      },
    });
  }

  private pickPermissions(permissions: Permissions) {
    return _.pick(permissions, Object.values(Permission));
  }

  private fillPermissions(permissions: Permissions) {
    return Object.values(Permission)
      .reduce((acc, permission) => {
          acc[permission] = permissions[permission] === true;
          return acc;
        }, {} as Permissions,
      );
  }
}

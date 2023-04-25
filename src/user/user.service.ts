import crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Role, UserDto, UserKeyDto } from '@poly/common';
import { User, UserKey } from '@prisma/client';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {
  }

  toDto(user: User): UserDto {
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
    };
  }

  async createUser(teamId: any, name: string, role: Role) {
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

  async createUserKey(environmentId: string, userId: string, key?: string) {
    return this.prisma.userKey.create({
      data: {
        key: key || crypto.randomUUID(),
        environment: {
          connect: {
            id: environmentId,
          },
        },
        user: {
          connect: {
            id: userId,
          },
        },
      },
    });
  }

  async findUserKey(userKey: string) {
    return this.prisma.userKey.findFirst({
      where: {
        key: userKey,
      },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findFirst({
      where: {
        id,
      },
    });
  }
}

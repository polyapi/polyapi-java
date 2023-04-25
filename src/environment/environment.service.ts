import crypto from 'crypto';
import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';
import { Environment } from '@prisma/client';
import { EnvironmentDto } from '@poly/common';

@Injectable()
export class EnvironmentService {
  constructor(
    private readonly prisma: PrismaService,
  ) {
  }

  toDto(environment: Environment): EnvironmentDto {
    return {
      id: environment.id,
      name: environment.name,
      appKey: environment.appKey,
    };
  }

  async getAllByTenant(tenantId: string) {
    return this.prisma.environment.findMany({
      where: {
        tenantId,
      },
    });
  }

  async create(tenantId: string, name: string) {
    return this.prisma.environment.create({
      data: {
        name,
        appKey: crypto.randomUUID(),
        tenant: {
          connect: {
            id: tenantId,
          },
        },
      },
    });
  }

  async findByKey(appKey: string) {
    return this.prisma.environment.findFirst({
      where: {
        appKey,
      },
      include: {
        tenant: true,
      }
    });
  }

  async findById(id: string) {
    return this.prisma.environment.findFirst({
      where: {
        id,
      },
      include: {
        tenant: true,
      }
    });
  }
}

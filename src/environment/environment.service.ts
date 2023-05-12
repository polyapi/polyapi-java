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
      subdomain: environment.subdomain,
      appKey: environment.appKey,
    };
  }

  generateAppKey() {
    return crypto.randomUUID();
  }

  generateSubdomainID() {
    return crypto.randomBytes(4).toString('hex');
  }

  async getAllByTenant(tenantId: string) {
    return this.prisma.environment.findMany({
      where: {
        tenantId,
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

  async create(tenantId: string, name: string) {
    return this.prisma.environment.create({
      data: {
        name,
        appKey: this.generateAppKey(),
        subdomain: this.generateSubdomainID(),
        tenant: {
          connect: {
            id: tenantId,
          },
        },
      },
    });
  }

  async update(environment: Environment, name: string) {
    return this.prisma.environment.update({
      where: {
        id: environment.id,
      },
      data: {
        name,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.environment.delete({
      where: {
        id,
      },
    });
  }
}

import { Injectable } from '@nestjs/common';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class ConfigVariableService {
  constructor(private readonly prisma: PrismaService) {}

  private create({
    name,
    environmentId = null,
    tenantId = null,
    value,
  }: {
    name: string;
    value: string;
    tenantId: string | null;
    environmentId: string | null;
  }) {
    return this.prisma.configVariable.create({
      data: {
        name,
        value,
        ...(environmentId ? { environmentId } : { tenantId }),
      },
    });
  }

  private getVariableByPriority(name: string, tenantId: string | null = null, environmentId: string | null = null) {
    const queryOpts: Parameters<typeof this.prisma.configVariable.findFirst>[0] = {
      where: {
        name,
        environmentId: null,
        tenantId: null,
      },
    };

    if (environmentId) {
      queryOpts.where = {
        ...queryOpts.where,
        environmentId,
      };
    } else if (tenantId) {
      queryOpts.where = {
        ...queryOpts.where,
        tenantId,
      };
    }

    return this.prisma.configVariable.findFirst(queryOpts);
  }

  async configure(name: string, value: string, tenantId: string | null = null, environmentId: string | null = null) {
    const foundConfigVariable = await this.getVariableByPriority(name, tenantId, environmentId);

    if (foundConfigVariable) {
      return this.prisma.configVariable.update({
        where: {
          id: foundConfigVariable.id,
        },
        data: {
          value,
        },
      });
    }

    return this.create({
      name,
      value,
      tenantId,
      environmentId,
    });
  }

  async get(name: string, tenantId: string | null = null, environmentId: string | null = null) {
    return this.getVariableByPriority(name, tenantId, environmentId);
  }
}

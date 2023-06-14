import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigVariable } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { ConfigVariableDto } from '@poly/common';

@Injectable()
export class ConfigVariableService {
  constructor(private readonly prisma: PrismaService) {}

  toDto(data: ConfigVariable): ConfigVariableDto {
    return {
      name: data.name,
      value: data.value,
      environmentId: data.environmentId,
      tenantId: data.tenantId,
    };
  }

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
        environmentId,
        tenantId,
      },
    });
  }

  private async getVariableByPriority(
    name: string,
    tenantId: string | null = null,
    environmentId: string | null = null,
  ) {
    console.log({
      tenantId,
      environmentId,
    });
    let configVarfiable: ConfigVariable | null = null;

    const list = await this.prisma.configVariable.findMany({
      where: {
        name,
      },
    });

    if (!list.length) {
      return null;
    }

    if (tenantId && environmentId) {
      configVarfiable =
        list.find((current) => current.tenantId === tenantId && current.environmentId === environmentId) || null;
    }

    if (!configVarfiable && tenantId) {
      configVarfiable = list.find((current) => current.tenantId === tenantId) || null;
    }

    if (!configVarfiable) {
      return list.find((current) => current.tenantId === null && current.environmentId === null) || null;
    }

    return configVarfiable;
  }

  async configure(name: string, value: string, tenantId: string | null = null, environmentId: string | null = null) {
    const foundConfigVariable = await this.prisma.configVariable.findFirst({
      where: {
        name,
        tenantId,
        environmentId,
      },
    });

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
    const configVarfiable = await this.getVariableByPriority(name, tenantId, environmentId);

    if (!configVarfiable) {
      throw new NotFoundException('Config variable not found');
    }

    return configVarfiable;
  }
}

import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigVariable } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { ConfigVariableDto } from '@poly/model';

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

  private getTenantAndEnvironmentFilter(tenantId: string, environmentId: string) {
    return (configVariable: ConfigVariable) =>
      configVariable.tenantId === tenantId && configVariable.environmentId === environmentId;
  }

  private getTenantFilter(tenantId: string) {
    return (configVariable: ConfigVariable) =>
      configVariable.tenantId === tenantId && configVariable.environmentId === null;
  }

  private getInstanceFilter() {
    return (configVariable: ConfigVariable) =>
      configVariable.tenantId === null && configVariable.environmentId === null;
  }

  private async getVariableByPriority(
    name: string,
    tenantId: string | null = null,
    environmentId: string | null = null,
  ) {
    let configVariable: ConfigVariable | null = null;

    const list = await this.prisma.configVariable.findMany({
      where: {
        name,
      },
    });

    if (!list.length) {
      return null;
    }

    if (tenantId && environmentId) {
      configVariable = list.find(this.getTenantAndEnvironmentFilter(tenantId, environmentId)) || null;

      if (!configVariable) {
        configVariable = list.find(this.getTenantFilter(tenantId)) || null;
      }

      if (!configVariable) {
        return list.find(this.getInstanceFilter()) || null;
      }

      return configVariable;
    }

    if (tenantId && !environmentId) {
      configVariable = list.find(this.getTenantFilter(tenantId)) || null;

      if (!configVariable) {
        return list.find(this.getInstanceFilter()) || null;
      }

      return configVariable;
    }

    return list.find(this.getInstanceFilter()) || null;
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

  async delete(name: string, tenantId: string | null = null, environmentId: string | null = null) {
    const configVarfiable = await this.prisma.configVariable.findFirst({
      where: {
        name,
        tenantId,
        environmentId,
      },
    });

    if (!configVarfiable) {
      throw new NotFoundException('Config variable not found');
    }

    return this.prisma.configVariable.delete({
      where: {
        id: configVarfiable.id,
      },
    });
  }
}

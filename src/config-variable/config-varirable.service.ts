import { Injectable } from '@nestjs/common';
import { ConfigVariable } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { ConfigVariableDto } from '@poly/model';

@Injectable()
export class ConfigVariableService {
  constructor(private readonly prisma: PrismaService) {}

  toDto(data: ConfigVariable): ConfigVariableDto {
    let parsedValue: unknown;

    try {
      parsedValue = JSON.parse(data.value);
    } catch (err) {
      parsedValue = data.value;
    }

    return {
      name: data.name,
      value: parsedValue,
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
    value: unknown;
    tenantId: string | null;
    environmentId: string | null;
  }) {
    return this.prisma.configVariable.create({
      data: {
        name,
        value: JSON.stringify(value),
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

  find(name: string, tenantId: string | null = null, environmentId: string | null = null) {
    return this.prisma.configVariable.findFirst({
      where: {
        name,
        tenantId,
        environmentId,
      },
    });
  }

  async getClosestChild(
    name: string,
    tenantId: string | null = null,
    environmentId: string | null = null,
  ) {
    let configVariable: ConfigVariable | null | undefined = null;

    const configVariables = await this.prisma.configVariable.findMany({
      where: {
        name,
      },
    });

    if (!configVariables.length) {
      return null;
    }

    if (tenantId && environmentId) {
      configVariable = configVariables.find(this.getTenantAndEnvironmentFilter(tenantId, environmentId));

      if (!configVariable) {
        configVariable = configVariables.find(this.getTenantFilter(tenantId));
      }

      if (!configVariable) {
        configVariable = configVariables.find(this.getInstanceFilter());
      }

      return configVariable || null;
    }

    if (tenantId && !environmentId) {
      configVariable = configVariables.find(this.getTenantFilter(tenantId));

      if (!configVariable) {
        configVariable = configVariables.find(this.getInstanceFilter());
      }

      return configVariable || null;
    }

    return configVariables.find(this.getInstanceFilter()) || null;
  }

  async configure(name: string, value: unknown, tenantId: string | null = null, environmentId: string | null = null) {
    const foundConfigVariable = await this.find(name, tenantId, environmentId);

    if (foundConfigVariable) {
      return this.prisma.configVariable.update({
        where: {
          id: foundConfigVariable.id,
        },
        data: {
          value: JSON.stringify(value),
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

  async delete(configVariable: ConfigVariable) {
    return this.prisma.configVariable.delete({
      where: {
        id: configVariable.id,
      },
    });
  }
}

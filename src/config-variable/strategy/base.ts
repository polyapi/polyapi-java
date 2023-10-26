import { PrismaService } from 'prisma-module/prisma.service';
import { ConfigVariable } from '@prisma/client';
import { ParsedConfigVariable } from '@poly/model';
import { CommonService } from 'common/common.service';

interface Strategy<T> {
  getOneFromList(configVariable: ConfigVariable[]): ConfigVariable | null;
  configure(name: string, value: unknown, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable>;
  getEffectiveValue(configVariables: ConfigVariable[]): T | null;
}

export abstract class ConfigVariableStrategy<T> implements Strategy<T> {
  constructor(protected prisma: PrismaService, protected commonService: CommonService) {}

  protected create({
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

  protected updateById(id: number, value: unknown) {
    return this.prisma.configVariable.update({
      where: {
        id,
      },
      data: {
        value: JSON.stringify(value),
      },
    });
  }

  protected getSortHandler() {
    return (a: ConfigVariable, b: ConfigVariable) => {
      if (!a.tenantId && !a.environmentId) {
        return -1;
      }

      if (!b.tenantId && !b.environmentId) {
        return 1;
      }

      if (a.tenantId && !a.environmentId) {
        return -1;
      }

      if (b.tenantId && !b.environmentId) {
        return 1;
      }

      return 0;
    };
  }

  protected getTenantAndEnvironmentFilter(tenantId: string, environmentId: string) {
    return (configVariable: ParsedConfigVariable<any>) =>
      configVariable.tenantId === tenantId && configVariable.environmentId === environmentId;
  }

  protected getTenantFilter(tenantId: string) {
    return (configVariable: ParsedConfigVariable<any>) =>
      configVariable.tenantId === tenantId && configVariable.environmentId === null;
  }

  protected getInstanceFilter() {
    return (configVariable: ParsedConfigVariable<any>) =>
      configVariable.tenantId === null && configVariable.environmentId === null;
  }

  abstract getOneFromList(configVariables: ConfigVariable[]): ConfigVariable | null;

  abstract configure(name: string, value: unknown, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable>;

  public getEffectiveValue(configVariables: ConfigVariable[]): T | null {
    const configVariable = this.getOneFromList(configVariables);
    return configVariable ? JSON.parse(configVariable.value) : null;
  }
}

import { ConfigVariable } from '@prisma/client';
import { ConfigVariableStrategy } from './base';

/**
 * In this strategy,`get` method returns the nearest child value, or child itself if exists.
 */
export class DefaultConfigVariableStrategy extends ConfigVariableStrategy {
  async get(name: string, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable | null> {
    let configVariable: ConfigVariable | null | undefined = null;

    const configVariables = await this.findMany(name, tenantId, environmentId);

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

  async configure(name: string, value: unknown, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable> {
    const foundConfigVariable = await this.prisma.configVariable.findFirst({
      where: {
        name,
        tenantId,
        environmentId,
      },
    });

    if (foundConfigVariable) {
      return this.updateById(foundConfigVariable.id, value);
    }

    return this.create({
      name,
      value,
      tenantId,
      environmentId,
    });
  }
}

import { ConfigVariable } from '@prisma/client';
import { ConfigVariableStrategy } from './base';

/**
 * In this strategy,`get` method returns the nearest child value, or child itself if exists.
 */
export class DefaultConfigVariableStrategy extends ConfigVariableStrategy {
  getOneFromList(configVariables: ConfigVariable[]): ConfigVariable | null {
    return configVariables.sort(this.getSortHandler())[configVariables.length - 1] || null;
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

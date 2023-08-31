import { ConfigVariableStrategy } from 'config-variable/strategy/base';
import { ConfigVariable } from '@prisma/client';
import { PublicVisibilityValue } from '@poly/model';

export class PublicVisibilityStrategy extends ConfigVariableStrategy<PublicVisibilityValue> {
  async configure(name: string, value: unknown, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable> {
    const {
      visibleContexts,
      defaultHidden,
    } = value as PublicVisibilityValue;
    const configVariable = await this.prisma.configVariable.findFirst({
      where: {
        name,
        tenantId,
        environmentId,
      },
    });

    if (configVariable) {
      const configVariableValue = JSON.parse(configVariable.value) as PublicVisibilityValue;

      value = {
        visibleContexts: visibleContexts === undefined ? configVariableValue.visibleContexts : visibleContexts,
        defaultHidden: defaultHidden ?? configVariableValue.defaultHidden,
      };
      return this.updateById(configVariable.id, value);
    } else {
      value = {
        visibleContexts,
        defaultHidden,
      };
      return this.create({ name, value, tenantId, environmentId });
    }
  }

  getEffectiveValue(configVariables: ConfigVariable[]): PublicVisibilityValue | null {
    const tenantConfigVariable = JSON.parse(
      configVariables.find(configVariable => configVariable.tenantId && !configVariable.environmentId)?.value || '{}',
    ) as PublicVisibilityValue;
    const environmentConfigVariable = JSON.parse(
      configVariables.find(configVariable => configVariable.environmentId)?.value || '{}',
    ) as PublicVisibilityValue;

    const visibleContexts = this.getEffectiveContextPaths(
      tenantConfigVariable.visibleContexts,
      environmentConfigVariable.visibleContexts,
    );

    return {
      defaultHidden: tenantConfigVariable.defaultHidden || environmentConfigVariable.defaultHidden || false,
      visibleContexts,
    };
  }

  private getEffectiveContextPaths(tenantContexts: string[] | undefined, environmentContexts: string[] | undefined): string[] {
    const result = [] as string[];

    if (!tenantContexts) {
      return environmentContexts || [];
    }
    if (!environmentContexts) {
      return tenantContexts || [];
    }

    environmentContexts.forEach(environmentContext => {
      tenantContexts.forEach(tenantContext => {
        if (environmentContext === tenantContext || environmentContext.startsWith(`${tenantContext}.`)) {
          result.push(environmentContext);
        }
      });
    });

    return result;
  }

  getOneFromList(configVariables: ConfigVariable[]): ConfigVariable | null {
    return configVariables.sort(this.getSortHandler())[configVariables.length - 1] || null;
  }
}

import { Jobs } from '@poly/model';
import { ConfigVariableStrategy } from './base';
import { ConfigVariable } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

export class JobsStrategy extends ConfigVariableStrategy<Jobs> {
  getOneFromList(configVariables: ConfigVariable[]): ConfigVariable | null {
    const sortedConfigVariables = configVariables.sort(this.getSortHandler()).reverse();

    let value: ConfigVariable | null = null;

    for (const configVariable of sortedConfigVariables) {
      if (value === null) {
        value = configVariable;
        continue;
      }

      const lastVariable = this.commonService.getConfigVariableWithParsedValue<Jobs>(value);
      const currentVariable = this.commonService.getConfigVariableWithParsedValue<Jobs>(configVariable);

      if (currentVariable.value.minimumIntervalTimeBetweenExecutions > lastVariable.value.minimumIntervalTimeBetweenExecutions) {
        value = {
          ...value,
          value: configVariable.value,
        };
      }
    }

    return value;
  }

  private validateValue(newValue: Jobs, configVariables: ConfigVariable[], foundVariable: ConfigVariable | undefined) {
    if (!configVariables.length) {
      throw new BadRequestException('Instance level `Jobs` config variable do not exists, please set it.');
    }

    for (const configVariable of configVariables) {
      if (foundVariable && (configVariable.id === foundVariable.id)) {
        continue;
      }

      const parsedConfigVariable = this.commonService.getConfigVariableWithParsedValue<Jobs>(configVariable).value;

      if (newValue.minimumIntervalTimeBetweenExecutions < parsedConfigVariable.minimumIntervalTimeBetweenExecutions) {
        throw new BadRequestException(`Current job limit (${newValue.minimumIntervalTimeBetweenExecutions} minutes) cannot be lower than ${parsedConfigVariable.minimumIntervalTimeBetweenExecutions} minutes.`);
      }
    }

    return true;
  }

  async configure(name: string, value: unknown, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable> {
    const newValue = value as Jobs;

    const configVariables = await this.prisma.configVariable.findMany({
      where: this.commonService.getConfigVariableFilters(name, tenantId, environmentId),
    });

    const sortedConfigVariables = configVariables.sort(this.getSortHandler());

    if (tenantId && environmentId) {
      const foundVariable = sortedConfigVariables.find(this.getTenantAndEnvironmentFilter(tenantId, environmentId));

      this.validateValue(newValue, sortedConfigVariables, foundVariable);

      if (foundVariable) {
        return this.updateById(foundVariable.id, newValue);
      } else {
        return this.create({ name, environmentId, tenantId, value: newValue });
      }
    }

    if (tenantId && !environmentId) {
      const foundVariable = sortedConfigVariables.find(this.getTenantFilter(tenantId));

      this.validateValue(newValue, sortedConfigVariables, foundVariable);

      if (foundVariable) {
        return this.updateById(foundVariable.id, newValue);
      } else {
        return this.create({ name, environmentId, tenantId, value: newValue });
      }
    }

    if (newValue.minimumIntervalTimeBetweenExecutions < 5) {
      throw new BadRequestException('Value cannot be less than 5 minutes.');
    }

    const foundVariable = sortedConfigVariables.find(this.getInstanceFilter());

    if (foundVariable) {
      return this.updateById(foundVariable.id, newValue);
    }

    return this.create({ name, value: newValue, tenantId, environmentId });
  }
}

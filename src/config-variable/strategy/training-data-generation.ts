import { merge } from 'lodash';
import { ConfigVariable } from '@prisma/client';
import { ConfigVariableStrategy } from './base';
import { SetTrainingDataGenerationValue, TrainingDataGeneration } from '@poly/model';

/**
 * In this strategy, on `get` method, object key values that are `null` will be replaced with nearest-parent values.
 * On `configure` method, on creation, non-specified keys will be `true` for instance level as default value and they will be `null` for rest
 * of levels as default value.
 * On updating, will merge incomming value with previous saved one.
 */
export class TrainingDataGenerationStrategy extends ConfigVariableStrategy {
  async get(name: string, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable | null> {
    const configVariables = await this.findMany(name, tenantId, environmentId);

    if (!configVariables.length) {
      return null;
    }

    const sortedConfigVariables = configVariables.sort(this.getSortHandler());

    const configVariable: ConfigVariable = sortedConfigVariables[sortedConfigVariables.length - 1];
    let parentValue = this.commonService.getConfigVariableWithParsedValue<TrainingDataGeneration>(configVariables[0]).value;

    const parsedConfigVariables = configVariables.slice(1).map(this.commonService.getConfigVariableWithParsedValue<TrainingDataGeneration>);

    for (const currentConfigVariable of parsedConfigVariables) {
      parentValue = this.mergeParentValueWithChild(parentValue, currentConfigVariable.value);
    }

    return {
      ...configVariable,
      value: JSON.stringify(parentValue),
    };
  }

  async configure(name: string, value: unknown, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable> {
    const newValue = value as SetTrainingDataGenerationValue;

    const configVariables = await this.findMany(name, tenantId, environmentId);

    const sortedConfigVariables = configVariables.sort(this.getSortHandler()).map(this.commonService.getConfigVariableWithParsedValue<TrainingDataGeneration>);

    if (tenantId && environmentId) {
      const foundVariable = sortedConfigVariables.find(this.getTenantAndEnvironmentFilter(tenantId, environmentId));

      if (foundVariable) {
        return this.updateById(foundVariable.id, this.mergeTrainingDataValue(foundVariable.value, newValue));
      } else {
        return this.create({ name, environmentId, tenantId, value: this.buildValueForCreate(newValue) });
      }
    }

    if (tenantId && !environmentId) {
      const foundVariable = sortedConfigVariables.find(this.getTenantFilter(tenantId));

      if (foundVariable) {
        return this.updateById(foundVariable.id, this.mergeTrainingDataValue(foundVariable.value, newValue));
      } else {
        return this.create({ name, environmentId, tenantId, value: this.buildValueForCreate(newValue) });
      }
    }

    const foundVariable = sortedConfigVariables.find(this.getInstanceFilter());

    if (foundVariable) {
      return this.updateById(foundVariable.id, this.mergeTrainingDataValue(foundVariable.value, newValue));
    }

    return this.create({ name, value: this.buildValueForCreate(newValue, true), tenantId, environmentId });
  }

  private buildValueForCreate(value: TrainingDataGeneration, instanceLevel = false): TrainingDataGeneration {
    return {
      apiFunctions: value.apiFunctions ?? (instanceLevel ? true : null),
      clientFunctions: value.clientFunctions ?? (instanceLevel ? true : null),
      serverFunctions: value.serverFunctions ?? (instanceLevel ? true : null),
      webhooks: value.webhooks ?? (instanceLevel ? true : null),
    };
  }

  private mergeParentValueWithChild(parentValue: TrainingDataGeneration, childValue: TrainingDataGeneration): TrainingDataGeneration {
    const finalValue: TrainingDataGeneration = parentValue;

    for (const [key, value] of Object.entries(childValue)) {
      const currentParentValue = parentValue[key] as boolean | null;

      if (currentParentValue === false) {
        continue;
      }

      if (value === false) {
        finalValue[key] = value;
      }
    }

    return finalValue;
  }

  private mergeTrainingDataValue(value: TrainingDataGeneration, newValue: SetTrainingDataGenerationValue) {
    return merge(value, newValue);
  }
}

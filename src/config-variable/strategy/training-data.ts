import { omitBy, merge, isNull } from 'lodash';
import { ConfigVariable } from '@prisma/client';
import { ConfigVariableStrategy } from './base';
import { SetTrainingDataGenerationValue, TrainingDataGeneration } from '../../../packages/model/src/dto';
import { BadRequestException } from '@nestjs/common';

export class TrainingDataGenerationStrategy extends ConfigVariableStrategy {
  async get(name: string, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable | null> {
    const configVariables = await this.findMany(name, tenantId, environmentId);

    if (!configVariables.length) {
      return null;
    }

    const sortedConfigVariables = configVariables.sort(this.getSortHandler());

    const configVariable: ConfigVariable = sortedConfigVariables[sortedConfigVariables.length - 1];
    let instanceValue = this.getConfigVariableWithParsedValue<TrainingDataGeneration>(configVariables[0]).value;

    const parsedConfigVariables = configVariables.slice(1).map(this.getConfigVariableWithParsedValue<TrainingDataGeneration>);

    for (const currentConfigVariable of parsedConfigVariables) {
      instanceValue = this.mergeParentValueWithChild(instanceValue, currentConfigVariable.value);
    }

    return {
      ...configVariable,
      value: JSON.stringify(instanceValue),
    };
  }

  async configure(name: string, value: unknown, tenantId: string | null, environmentId: string | null): Promise<ConfigVariable> {
    const newValue = value as SetTrainingDataGenerationValue;

    const configVariables = await this.findMany(name, tenantId, environmentId);

    const sortedConfigVariables = configVariables.sort(this.getSortHandler()).map(this.getConfigVariableWithParsedValue<TrainingDataGeneration>);

    if (tenantId && environmentId) {
      for (const configVariable of sortedConfigVariables) {
        if (configVariable.tenantId && configVariable.environmentId) {
          break;
        }
        this.throwErrIfCannotSetNewValue(configVariable.value, newValue);
      }

      const foundVariable = sortedConfigVariables.find(this.getTenantAndEnvironmentFilter(tenantId, environmentId));

      if (foundVariable) {
        return this.updateById(foundVariable.id, this.mergeTrainingDataValue(foundVariable.value, newValue));
      } else {
        return this.create({ name, environmentId, tenantId, value: newValue });
      }
    }

    if (tenantId && !environmentId) {
      for (const configVariable of sortedConfigVariables) {
        if (configVariable.tenantId && !configVariable.environmentId) {
          break;
        }
        this.throwErrIfCannotSetNewValue(configVariable.value, newValue);
      }

      const foundVariable = sortedConfigVariables.find(this.getTenantFilter(tenantId));

      if (foundVariable) {
        return this.updateById(foundVariable.id, this.mergeTrainingDataValue(foundVariable.value, newValue));
      } else {
        return this.create({ name, environmentId, tenantId, value: newValue });
      }
    }

    const foundVariable = sortedConfigVariables.find(this.getInstanceFilter());

    if (foundVariable) {
      return this.updateById(foundVariable.id, this.mergeTrainingDataValue(foundVariable.value, newValue));
    }

    return this.create({ name, value: newValue, tenantId, environmentId });
  }

  private mergeParentValueWithChild(parentValue: TrainingDataGeneration, childValue: TrainingDataGeneration): TrainingDataGeneration {
    const finalValue: TrainingDataGeneration = parentValue;

    for (const [key, value] of Object.entries(childValue)) {
      const currentParentValue = parentValue[key] as boolean | undefined;

      if (currentParentValue === false) {
        continue;
      }

      finalValue[key] = value;
    }

    return finalValue;
  }

  private throwErrIfCannotSetNewValue(value: TrainingDataGeneration, newValue: SetTrainingDataGenerationValue) {
    for (const key of Object.keys(newValue)) {
      if (newValue[key] !== null && (value[key] === false && newValue[key])) {
        throw new BadRequestException(`Cannot set ${key} = true if is false in a higher level.`);
      }
    }
  }

  private mergeTrainingDataValue(value: TrainingDataGeneration, newValue: SetTrainingDataGenerationValue) {
    return omitBy(merge(value, newValue), isNull);
  }
}

import { merge, omitBy, isNull } from 'lodash';
import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigVariable } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { ConfigVariableDto, ConfigVariableName, SetTrainingDataGenerationValue } from '@poly/model';

import { TrainingDataGeneration } from '@poly/model';
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

  async configure(name: string, value: unknown, tenantId: string | null = null, environmentId: string | null = null) {
    if (name === ConfigVariableName.TrainingDataGeneration) {
      return this.configureTrainingDataGenerationStrategy(name, value, tenantId, environmentId);
    }

    return this.defaultConfigureStrategy(name, value, tenantId, environmentId);
  }

  async delete(configVariable: ConfigVariable) {
    return this.prisma.configVariable.delete({
      where: {
        id: configVariable.id,
      },
    });
  }

  private findMany(name: string, tenantId: string | null = null, environmentId: string | null = null) {
    const conditions: [{ name: string, tenantId: string | null, environmentId?: string | null }] = [
      {
        name,
        tenantId: null,
        environmentId: null,
      },
    ];

    if (tenantId) {
      conditions.push({
        name,
        tenantId,
        environmentId: null,
      });
    }
    if (environmentId) {
      conditions.push({
        name,
        tenantId,
        environmentId,
      });
    }

    return this.prisma.configVariable.findMany({
      where: {
        OR: conditions,
      },
    });
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

  private updateById(id: number, value: unknown) {
    return this.prisma.configVariable.update({
      where: {
        id,
      },
      data: {
        value: JSON.stringify(value),
      },
    });
  }

  private getSortHandler() {
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

  private getConfigVariableWithParsedValue<T = any>(configVariable: ConfigVariable): ConfigVariable & { value: T } {
    return {
      ...configVariable,
      value: JSON.parse(configVariable.value),
    };
  }

  private async defaultConfigureStrategy(name: string, value: unknown, tenantId: string | null = null, environmentId: string | null = null) {
    const foundConfigVariable = await this.find(name, tenantId, environmentId);

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

  private async configureTrainingDataGenerationStrategy(name: string, value: unknown, tenantId: string | null = null, environmentId: string | null = null) {
    const newValue = value as SetTrainingDataGenerationValue;

    const configVariables = await this.findMany(name, tenantId, environmentId);

    console.log('configVariables: ', configVariables);

    const sortedConfigVariables = configVariables.sort(this.getSortHandler()).map(this.getConfigVariableWithParsedValue<TrainingDataGeneration>);

    console.log('sortedConfigVariables: ', sortedConfigVariables);

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
}

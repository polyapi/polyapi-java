import { Injectable } from '@nestjs/common';
import { ConfigVariable } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { ConfigVariableDto, ConfigVariableName, DefaultTierValue, DefaultTosValue, PublicVisibilityValue, TrainingDataGeneration } from '@poly/model';
import {
  ConfigVariableStrategy,
  DefaultConfigVariableStrategy,
  TrainingDataGenerationStrategy,
  PublicVisibilityStrategy,
  DefaultTierStrategy,
  DefaultTosStrategy,
} from './strategy';
import { CommonService } from 'common/common.service';

@Injectable()
export class ConfigVariableService {
  private readonly prisma: PrismaService;
  private readonly commonService: CommonService;

  private readonly defaultConfigVariableStrategy: ConfigVariableStrategy<unknown>;
  private readonly trainingDataStrategy: ConfigVariableStrategy<TrainingDataGeneration>;
  private readonly publicVisibilityStrategy: ConfigVariableStrategy<PublicVisibilityValue>;
  private readonly defaultTierVisibilityStrategy: ConfigVariableStrategy<DefaultTierValue>;
  private readonly defaultTosStrategy: ConfigVariableStrategy<DefaultTosValue>;

  constructor(prisma: PrismaService, commonService: CommonService) {
    this.prisma = prisma;
    this.commonService = commonService;
    this.defaultConfigVariableStrategy = new DefaultConfigVariableStrategy(prisma, commonService);
    this.trainingDataStrategy = new TrainingDataGenerationStrategy(prisma, commonService);
    this.publicVisibilityStrategy = new PublicVisibilityStrategy(prisma, commonService);
    this.defaultTierVisibilityStrategy = new DefaultTierStrategy(prisma, commonService);
    this.defaultTosStrategy = new DefaultTosStrategy(prisma, commonService);
  }

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

  private getStrategy<T>(name: string): ConfigVariableStrategy<T> {
    switch (name) {
      case ConfigVariableName.TrainingDataGeneration:
        return this.trainingDataStrategy as ConfigVariableStrategy<T>;
      case ConfigVariableName.PublicVisibility:
        return this.publicVisibilityStrategy as ConfigVariableStrategy<T>;
      case ConfigVariableName.DefaultTier:
        return this.defaultTierVisibilityStrategy as ConfigVariableStrategy<T>;
      case ConfigVariableName.DefaultTos:
        return this.defaultTosStrategy as ConfigVariableStrategy<T>;
      default:
        return this.defaultConfigVariableStrategy as ConfigVariableStrategy<T>;
    }
  }

  async getOneParsed<T>(
    name: string,
    tenantId: string | null = null,
    environmentId: string | null = null,
  ) {
    const configVariable = await this.getOne(name, tenantId, environmentId);

    return configVariable ? this.commonService.getConfigVariableWithParsedValue<T>(configVariable) : null;
  }

  async getOne(
    name: string,
    tenantId: string | null = null,
    environmentId: string | null = null,
  ) {
    const configVariables = await this.prisma.configVariable.findMany({
      where: this.commonService.getConfigVariableFilters(name, tenantId, environmentId),
    });

    return this.getStrategy(name).getOneFromList(configVariables);
  }

  async getMany(tenantId: string | null = null, environmentId: string | null = null) {
    const configVariables = await this.prisma.configVariable.findMany({
      where: this.commonService.getConfigVariableFilters(null, tenantId, environmentId),
    });

    const result: ConfigVariable[] = [];

    for (const configVariable of configVariables) {
      if (result.find(current => current.name === configVariable.name)) {
        continue;
      }

      const restConfigVariablesBySameName = configVariables.filter(current => current.id !== configVariable.id && current.name === configVariable.name);

      result.push(this.getStrategy(configVariable.name).getOneFromList([configVariable, ...restConfigVariablesBySameName]) as ConfigVariable);
    }

    return result;
  }

  configure(name: string, value: unknown, tenantId: string | null = null, environmentId: string | null = null) {
    return this.getStrategy(name).configure(name, value, tenantId, environmentId);
  }

  delete(configVariable: ConfigVariable) {
    return this.prisma.configVariable.delete({
      where: {
        id: configVariable.id,
      },
    });
  }

  async getEffectiveValue<T>(name: ConfigVariableName, tenantId: string | null, environmentId: string | null) {
    const configVariables = await this.prisma.configVariable.findMany({
      where: this.commonService.getConfigVariableFilters(name, tenantId, environmentId),
    });

    return this.getStrategy<T>(name).getEffectiveValue(configVariables);
  }
}

import { Injectable } from '@nestjs/common';
import { ConfigVariable } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

import { ConfigVariableDto, ConfigVariableName } from '@poly/model';

import { ConfigVariableStrategy, DefaultConfigVariableStrategy, TrainingDataGenerationStrategy } from './strategy';
@Injectable()
export class ConfigVariableService {
  private readonly prisma: PrismaService;

  private defaultConfigVariableStrategy: ConfigVariableStrategy;
  private trainingDataStrategy: ConfigVariableStrategy;

  constructor(prisma: PrismaService) {
    this.prisma = prisma;
    this.defaultConfigVariableStrategy = new DefaultConfigVariableStrategy(prisma);
    this.trainingDataStrategy = new TrainingDataGenerationStrategy(prisma);
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

  private getStrategy(name: string): ConfigVariableStrategy {
    if (name === ConfigVariableName.TrainingDataGeneration) {
      return this.trainingDataStrategy;
    }

    return this.defaultConfigVariableStrategy;
  }

  get(
    name: string,
    tenantId: string | null = null,
    environmentId: string | null = null,
  ) {
    return this.getStrategy(name).get(name, tenantId, environmentId);
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
}

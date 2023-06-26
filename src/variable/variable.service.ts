import { ConflictException, Injectable, Logger } from '@nestjs/common';
import { Variable } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { ValueType, VariableDto, Visibility } from '@poly/model';
import { SecretService } from 'secret/secret.service';
import { CommonService } from 'common/common.service';

@Injectable()
export class VariableService {
  private readonly logger = new Logger(VariableService.name);

  constructor(
    private readonly commonService: CommonService,
    private readonly prisma: PrismaService,
    private readonly secretService: SecretService,
  ) {
  }

  async toDto(variable: Variable): Promise<VariableDto> {
    return {
      id: variable.id,
      context: variable.context,
      name: variable.name,
      description: variable.description,
      visibility: variable.visibility as Visibility,
      secret: variable.secret,
      value: variable.secret ? undefined : await this.secretService.get(variable.environmentId, variable.id),
    };
  }

  async getAll(environmentId: string): Promise<Variable[]> {
    return this.prisma.variable.findMany({
      where: {
        environmentId,
      },
    });
  }

  async findById(id: string): Promise<Variable | null> {
    return this.prisma.variable.findFirst({
      where: {
        id,
      },
    });
  }

  async createVariable(environmentId: string, context: string, name: string, description: string, value: ValueType, visibility: Visibility, secret = false): Promise<Variable> {
    this.logger.log(`Creating variable '${name}' in context '${context}' for environment ${environmentId}`);

    name = this.commonService.sanitizeNameIdentifier(name);
    context = this.commonService.sanitizeContextIdentifier(context);

    if (!await this.checkContextAndNameDuplicates(environmentId, context, name)) {
      throw new ConflictException(`Variable with name '${name}' and context '${context}' already exists`);
    }

    return await this.prisma.$transaction(async (tx) => {
      const variable = await tx.variable.create({
        data: {
          environmentId,
          context,
          name,
          description,
          visibility,
          secret,
        },
      });

      await this.secretService.set(environmentId, variable.id, value);

      return variable;
    });
  }

  async updateVariable(
    environmentId: string,
    variable: Variable,
    name: string | undefined,
    context: string | undefined,
    description: string | undefined,
    value: ValueType | undefined,
    visibility: Visibility | undefined,
    secret: boolean | undefined,
  ): Promise<Variable> {
    name = name && this.commonService.sanitizeNameIdentifier(name);
    context = context && this.commonService.sanitizeContextIdentifier(context);

    if (!await this.checkContextAndNameDuplicates(environmentId, context ?? variable.context, name ?? variable.name, [variable.id])) {
      throw new ConflictException(`Variable with name '${name ?? variable.name}' and context '${context ?? variable.context}' already exists`);
    }

    return this.prisma.$transaction(async (tx) => {
      this.logger.log(`Updating variable ${variable.id}`);
      const updatedVariable = await tx.variable.update({
        where: {
          id: variable.id,
        },
        data: {
          name: name || variable.name,
          context: context ?? variable.context,
          description: description ?? variable.description,
          visibility: visibility ?? variable.visibility,
          secret: secret ?? variable.secret,
        },
        include: {
          environment: true,
        },
      });

      if (value) {
        this.logger.log(`Updating variable ${variable.id} value`);
        await this.secretService.set(environmentId, variable.id, value);
      }

      return updatedVariable;
    });
  }

  async deleteVariable(variable: Variable): Promise<void> {
    this.logger.log(`Deleting variable ${variable.id}`);

    await this.prisma.$transaction(async (tx) => {
      const deletedVariable = await tx.variable.delete({
        where: {
          id: variable.id,
        },
        include: {
          environment: true,
        },
      });

      await this.secretService.delete(deletedVariable.environment.id, variable.id);
    });
  }

  private async checkContextAndNameDuplicates(environmentId, context: string, name: string, excludedIds?: string[]) {
    // TODO: it's probably better check this via SpecService similar to how it's done in FunctionService
    // TODO: should be changed as part of #518 task
    const existingCount = await this.prisma.variable.count({
      where: {
        environmentId,
        context,
        name,
        id: {
          notIn: excludedIds,
        },
      },
    });

    return existingCount === 0;
  }
}

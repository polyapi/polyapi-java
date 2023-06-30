import { ConflictException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Variable } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import { ServerVariableSpecification, ValueType, VariableDto, Visibility } from '@poly/model';
import { SecretService } from 'secret/secret.service';
import { CommonService } from 'common/common.service';
import { SpecsService } from 'specs/specs.service';
import { AuthData } from 'common/types';
import { AuthService } from 'auth/auth.service';
import { FunctionService } from 'function/function.service';
import { EventService } from 'event/event.service';

@Injectable()
export class VariableService {
  private readonly logger = new Logger(VariableService.name);

  constructor(
    private readonly commonService: CommonService,
    private readonly prisma: PrismaService,
    private readonly secretService: SecretService,
    @Inject(forwardRef(() => SpecsService))
    private readonly specsService: SpecsService,
    private readonly authService: AuthService,
    @Inject(forwardRef(() => FunctionService))
    private readonly functionService: FunctionService,
    private readonly eventService: EventService,
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
      value: variable.secret ? undefined : await this.getVariableValue(variable),
    };
  }

  async getAll(environmentId: string, contexts?: string[], names?: string[], ids?: string[], includePublic = false, includeTenant = false): Promise<Variable[]> {
    return this.prisma.variable.findMany({
      where: {
        AND: [
          {
            OR: [
              { environmentId },
              includePublic
                ? this.commonService.getPublicVisibilityFilterCondition()
                : {},
            ],
          },
          {
            OR: this.commonService.getContextsNamesIdsFilterConditions(contexts, names, ids),
          },
        ],
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: includeTenant
        ? {
            environment: {
              include: {
                tenant: true,
              },
            },
          }
        : undefined,
    });
  }

  async findById(id: string): Promise<Variable | null> {
    return this.prisma.variable.findFirst({
      where: {
        id,
      },
    });
  }

  async findByPath(environmentId: string, path: string): Promise<Variable | null> {
    const pathParts = path.split('.');

    // get private first
    let variables = await this.getAll(
      environmentId,
      [pathParts.slice(0, -1).join('.')],
      [pathParts[pathParts.length - 1]],
      undefined,
      false,
    );
    if (variables.length) {
      return variables[0];
    }

    // get public
    variables = await this.getAll(
      environmentId,
      [pathParts.slice(0, -1).join('.')],
      [pathParts[pathParts.length - 1]],
      undefined,
      true,
    );

    return variables[0] || null;
  }

  async getVariableValue(variable: Variable) {
    return this.secretService.get(variable.environmentId, variable.id);
  }

  async createVariable(environmentId: string, context: string, name: string, description: string, value: ValueType, visibility: Visibility, secret = false): Promise<Variable> {
    this.logger.debug(`Creating variable '${name}' in context '${context}' for environment ${environmentId}`);

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
      this.logger.debug(`Updating variable ${variable.id}`);
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
        this.logger.debug(`Updating variable ${variable.id} value`);
        await this.secretService.set(environmentId, variable.id, value);

        if (!(secret ?? variable.secret)) {
          this.logger.debug(`Sending update event for variable ${variable.id}.`);
          this.eventService.sendVariableUpdateEvent(variable.id, value);
        }
      }

      return updatedVariable;
    });
  }

  async deleteVariable(variable: Variable): Promise<void> {
    this.logger.debug(`Deleting variable ${variable.id}`);

    const functionsWithVariableArgument = await this.functionService.getFunctionsWithVariableArgument(`${variable.context}.${variable.name}`);
    if (functionsWithVariableArgument.length) {
      throw new ConflictException(
        `Variable cannot be deleted as it is used in function(s): ${functionsWithVariableArgument.map((f) => f.id).join(', ')}`,
      );
    }

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

      if (!variable.secret) {
        await this.eventService.sendVariableUpdateEvent(variable.id, null);
      }
    });
  }

  async toServerVariableSpecification(variable: Variable): Promise<ServerVariableSpecification> {
    const value = await this.secretService.get(variable.environmentId, variable.id);
    const [type, typeSchema] = await this.commonService.resolveType('ValueType', value);

    return {
      type: 'serverVariable',
      id: variable.id,
      name: variable.name,
      context: variable.context,
      description: variable.description,
      visibilityMetadata: {
        visibility: variable.visibility as Visibility,
      },
      variable: {
        environmentId: variable.environmentId,
        secret: variable.secret,
        valueType: variable.secret
          ? {
              kind: 'object',
            }
          : await this.commonService.toPropertyType(variable.name, type, value, typeSchema),
        value: variable.secret ? undefined : value,
      },
    };
  }

  async unwrapSecretVariables<T extends Record<string, any>>(authData: AuthData, obj: T): Promise<T> {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'object' && value.type === 'PolyVariable' && value.id) {
        const variable = await this.findById(value.id);
        if (variable) {
          await this.authService.checkEnvironmentEntityAccess(variable, authData, true);
          obj[key as keyof T] = await this.secretService.get(variable.environmentId, variable.id);
        }
      } else if (typeof value === 'object') {
        obj[key as keyof T] = await this.unwrapSecretVariables(authData, value);
      }
    }
    return obj;
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

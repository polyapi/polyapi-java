import { get, set } from 'lodash';
import crypto from 'crypto';
import { ConflictException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Variable } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import {
  ContextVariableValues,
  ServerVariableSpecification,
  ValueType,
  VariableDto,
  Visibility,
  VisibilityQuery,
} from '@poly/model';
import { SecretService } from 'secret/secret.service';
import { CommonService } from 'common/common.service';
import { SpecsService } from 'specs/specs.service';
import { AuthData } from 'common/types';
import { AuthService } from 'auth/auth.service';
import { FunctionService } from 'function/function.service';
import { EventService } from 'event/event.service';
import { AiService } from 'ai/ai.service';

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
    private readonly aiService: AiService,
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

  async getAll(environmentId: string, contexts?: string[], names?: string[], ids?: string[], visibilityQuery?: VisibilityQuery, includeTenant = false): Promise<Variable[]> {
    return this.prisma.variable.findMany({
      where: {
        AND: [
          {
            OR: [
              { environmentId },
              visibilityQuery
                ? this.commonService.getVisibilityFilterCondition(visibilityQuery)
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

  async findById(id: string, includeEnvironment = false): Promise<Variable | null> {
    return this.prisma.variable.findFirst({
      where: {
        id,
      },
      include: {
        environment: includeEnvironment,
      },
    });
  }

  async findByPath(environmentId: string, tenantId: string | null, path: string): Promise<Variable | null> {
    const pathParts = path.split('.');

    // get private first
    let variables = await this.getAll(
      environmentId,
      [pathParts.slice(0, -1).join('.')],
      [pathParts[pathParts.length - 1]],
      undefined,
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
      {
        includePublic: true,
        tenantId,
      },
    );

    return variables[0] || null;
  }

  async getVariableValue(variable: Variable, path?: string) {
    const value = await this.secretService.get(variable.environmentId, variable.id);
    if (!path || typeof value !== 'object') {
      return value;
    }

    try {
      return this.commonService.getPathContent(value, path);
    } catch (e) {
      this.logger.error(`Error getting path content for variable ${variable.id}, path=${path}: ${e.message}`);
      return undefined;
    }
  }

  async createVariable(environmentId: string, context: string, name: string, description: string, value: ValueType, visibility: Visibility, secret = false): Promise<Variable> {
    this.logger.debug(`Creating variable '${name}' in context '${context}' for environment ${environmentId}`);

    name = this.commonService.sanitizeNameIdentifier(name);
    context = this.commonService.sanitizeContextIdentifier(context);

    if (!await this.checkContextAndNameDuplicates(environmentId, context, name)) {
      throw new ConflictException(`Variable with name '${name}' and context '${context}' already exists`);
    }

    description = description || (await this.aiService.getVariableDescription(name, context, secret, JSON.stringify(this.getValueApproximation(value, secret)))).description;

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
    updatedBy: string,
    variable: Variable,
    name: string | undefined,
    context: string | undefined,
    description: string | undefined,
    value: ValueType | undefined,
    visibility: Visibility | undefined,
    secret: boolean | undefined,
  ): Promise<Variable> {
    name = (name && this.commonService.sanitizeNameIdentifier(name)) || variable.name;
    context = (context && this.commonService.sanitizeContextIdentifier(context)) ?? variable.context;
    secret = secret ?? variable.secret;

    if (!await this.checkContextAndNameDuplicates(environmentId, context, name, [variable.id])) {
      throw new ConflictException(`Variable with name '${name}' and context '${context}' already exists`);
    }

    description = description === '' && value
      ? (await this.aiService.getVariableDescription(name, context, secret, JSON.stringify(value))).description
      : description;

    return this.prisma.$transaction(async (tx) => {
      this.logger.debug(`Updating variable ${variable.id}`);
      const updatedVariable = await tx.variable.update({
        where: {
          id: variable.id,
        },
        data: {
          name,
          context,
          description: description ?? variable.description,
          visibility: visibility ?? variable.visibility,
          secret,
        },
        include: {
          environment: true,
        },
      });

      const previousValue = variable.secret
        ? '********'
        : await this.getVariableValue(variable);

      if (value) {
        this.logger.debug(`Updating variable ${variable.id} value`);
        await this.secretService.set(environmentId, variable.id, value);
      }

      if ((value !== undefined && value !== previousValue) || secret !== variable.secret) {
        const currentValue = secret
          ? '********'
          : value || await this.getVariableValue(updatedVariable);

        this.logger.debug(`Sending change event for variable ${variable.id}.`);
        await this.eventService.sendVariableChangeEvent(updatedVariable, {
          type: 'update',
          previousValue,
          currentValue,
          updatedBy,
          updateTime: Date.now(),
          updatedFields: [
            value !== undefined && value !== previousValue ? 'value' : null,
            secret !== variable.secret ? 'secret' : null,
          ].filter(Boolean) as ('value' | 'secret')[],
          secret: secret as boolean,
          path: `${context ? `${context}.` : ''}${name}`,
        });
      }

      return updatedVariable;
    });
  }

  async deleteVariable(variable: Variable, deletedBy: string): Promise<void> {
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

      const previousValue = variable.secret
        ? '********'
        : await this.getVariableValue(variable);

      await this.secretService.delete(deletedVariable.environment.id, variable.id);
      await this.eventService.sendVariableChangeEvent(deletedVariable, {
        type: 'delete',
        previousValue,
        currentValue: null,
        updatedBy: deletedBy,
        updateTime: Date.now(),
        updatedFields: [],
        secret: variable.secret,
        path: `${variable.context ? `${variable.context}.` : ''}${variable.name}`,
      });
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

  async getContextVariableValues(environmentId: string, tenantId: string, context: string | null): Promise<ContextVariableValues> {
    const variables = (
      await this.getAll(
        environmentId,
        context ? [context] : undefined,
        undefined,
        undefined,
        { includePublic: true, tenantId },
      )
    ).filter(variable => !variable.secret);
    const contextValues = {} as ContextVariableValues;

    for (const variable of variables) {
      const subContext = variable.context.substring(context ? context.length + 1 : 0);
      if (subContext) {
        let subContextValues = get(contextValues, subContext);
        if (!subContextValues) {
          subContextValues = {};
          set(contextValues, subContext, subContextValues);
        }
        subContextValues[variable.name] = await this.getVariableValue(variable);
      } else {
        contextValues[variable.name] = await this.getVariableValue(variable);
      }
    }

    return contextValues;
  }

  async unwrapVariables<T extends Record<string, any>>(authData: AuthData, obj: T): Promise<T> {
    for (const key of Object.keys(obj)) {
      const value = obj[key];
      if (typeof value === 'object' && value.type === 'PolyVariable' && value.id) {
        const variable = await this.findById(value.id, true);
        if (variable) {
          await this.authService.checkEnvironmentEntityAccess(variable, authData, true);
          obj[key as keyof T] = await this.getVariableValue(variable, value.path);
        }
      } else if (typeof value === 'object') {
        obj[key as keyof T] = await this.unwrapVariables(authData, value);
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

  private getValueApproximation(value: ValueType, secret: boolean): ValueType {
    if (!secret || !value) {
      return value;
    }

    if (typeof value === 'string') {
      return crypto.randomBytes(32).toString('hex');
    } else if (typeof value === 'number') {
      return Math.floor(Math.random() * 1000000);
    } else if (typeof value === 'boolean') {
      return value;
    } else if (Array.isArray(value)) {
      return value.map(item => this.getValueApproximation(item, secret));
    } else if (typeof value === 'object') {
      return Object.keys(value).reduce((acc, key) => {
        acc[key] = this.getValueApproximation(value[key], secret);
        return acc;
      }, {});
    } else {
      this.logger.warn(`Unknown value type: ${typeof value}`);
      return '********';
    }
  }
}

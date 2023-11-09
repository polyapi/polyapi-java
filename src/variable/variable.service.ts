import { get, isEqual, set } from 'lodash';
import crypto from 'crypto';
import { toCamelCase } from '@guanghechen/helper-string';
import { ConflictException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Environment, Tenant, Variable } from '@prisma/client';
import { PrismaService } from 'prisma-module/prisma.service';
import {
  ConfigVariableName,
  ContextVariableValues,
  PublicVisibilityValue,
  ServerVariableSpecification,
  ValueType,
  VariableDto,
  VariablePublicDto,
  Visibility,
  VisibilityQuery,
} from '@poly/model';
import { SecretService } from 'secret/secret.service';
import { CommonService } from 'common/common.service';
import { SpecsService } from 'specs/specs.service';
import { AuthData, WithTenant } from 'common/types';
import { AuthService } from 'auth/auth.service';
import { FunctionService } from 'function/function.service';
import { EventService } from 'event/event.service';
import { AiService } from 'ai/ai.service';
import { ConfigVariableService } from 'config-variable/config-variable.service';

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
    private readonly configVariableService: ConfigVariableService,
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

  async toPublicDto(variable: WithTenant<Variable> & { hidden: boolean }): Promise<VariablePublicDto> {
    return {
      ...await this.toDto(variable),
      context: this.commonService.getPublicContext(variable),
      tenant: variable.environment.tenant.name || '',
      hidden: variable.hidden,
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

  async getAllPublic(tenant: Tenant, environment: Environment, includeHidden = false) {
    const variables = await this.prisma.variable.findMany({
      where: {
        visibility: Visibility.Public,
        environment: {
          tenant: {
            NOT: {
              id: tenant.id,
            },
            publicVisibilityAllowed: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      include: {
        environment: {
          include: {
            tenant: true,
          },
        },
      },
    });

    return (
      await Promise.all(
        variables.map(variable => this.resolveVisibility(tenant, environment, variable)),
      )
    ).filter(variable => includeHidden || !variable.hidden);
  }

  async findPublicById(tenant: Tenant, environment: Environment, id: string) {
    const variable = await this.prisma.variable.findFirst({
      where: {
        id,
        visibility: Visibility.Public,
        environment: {
          tenant: {
            NOT: {
              id: tenant.id,
            },
            publicVisibilityAllowed: true,
          },
        },
      },
      include: {
        environment: {
          include: {
            tenant: true,
          },
        },
      },
    });

    if (!variable) {
      return null;
    }
    return this.resolveVisibility(tenant, environment, variable);
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

    name = toCamelCase(this.commonService.sanitizeNameIdentifier(name));
    context = this.commonService.sanitizeContextIdentifier(context);

    if (!await this.checkContextAndNameDuplicates(environmentId, context, name)) {
      throw new ConflictException(`Variable with name '${name}' and context '${context}' already exists`);
    }

    description = description || (await this.aiService.getVariableDescription(environmentId, name, context, secret, JSON.stringify(this.getValueApproximation(value, secret)))).description;

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
    }, {
      timeout: 10_000,
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
    name = (name && toCamelCase(this.commonService.sanitizeNameIdentifier(name))) || variable.name;
    context = (context && this.commonService.sanitizeContextIdentifier(context)) ?? variable.context;
    secret = secret ?? variable.secret;

    if (!await this.checkContextAndNameDuplicates(environmentId, context, name, [variable.id])) {
      throw new ConflictException(`Variable with name '${name}' and context '${context}' already exists`);
    }

    const pathChanged = `${variable.context}.${variable.name}` !== `${context}.${name}`;
    if (pathChanged) {
      const functionsWithVariableArgument = await this.functionService.getFunctionsWithVariableArgument(
        variable.environmentId,
        `${variable.context}.${variable.name}`,
      );
      if (functionsWithVariableArgument.length) {
        throw new ConflictException(
          `Cannot change name and/or context of Variable as it is used in function(s): ${functionsWithVariableArgument.map((f) => f.id).join(', ')}`,
        );
      }
    }

    description = description === '' && value
      ? (await this.aiService.getVariableDescription(environmentId, name, context, secret, JSON.stringify(value))).description
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

      const previousValue = await this.getVariableValue(variable);

      if (value) {
        this.logger.debug(`Updating variable ${variable.id} value`);
        await this.secretService.set(environmentId, variable.id, value);
      }

      if ((value !== undefined && !isEqual(value, previousValue)) || secret !== variable.secret) {
        const currentValue = value || await this.getVariableValue(updatedVariable);

        this.logger.debug(`Sending change event for variable ${variable.id}.`);
        await this.eventService.sendVariableChangeEvent(updatedVariable, {
          type: 'update',
          previousValue: variable.secret ? '********' : previousValue,
          currentValue: secret ? '********' : currentValue,
          updatedBy,
          updateTime: Date.now(),
          updatedFields: [
            value !== undefined && !isEqual(currentValue, previousValue) ? 'value' : null,
            secret !== variable.secret ? 'secret' : null,
          ].filter(Boolean) as ('value' | 'secret')[],
          secret: secret as boolean,
          path: `${context ? `${context}.` : ''}${name}`,
        });
      }

      return updatedVariable;
    }, {
      timeout: 10_000,
    });
  }

  async deleteVariable(variable: Variable, deletedBy: string): Promise<void> {
    this.logger.debug(`Deleting variable ${variable.id}`);

    const functionsWithVariableArgument = await this.functionService.getFunctionsWithVariableArgument(
      variable.environmentId,
      `${variable.context}.${variable.name}`,
    );
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
    }, {
      timeout: 10_000,
    });
  }

  async toServerVariableSpecification(variable: Variable): Promise<ServerVariableSpecification> {
    const value = await this.secretService.get<any>(variable.environmentId, variable.id);
    const [type, typeSchema] = await this.commonService.resolveType('ValueType', value, undefined, false);

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

  async unwrapVariables<T>(authData: AuthData, obj: T, checkVariableAccess?: (variable: Variable) => Promise<void>): Promise<T> {
    if (obj instanceof Object) {
      if (obj['type'] === 'PolyVariable' && obj['id']) {
        const variable = await this.findById(obj['id'], true);
        if (variable) {
          await checkVariableAccess?.(variable);
          await this.authService.checkEnvironmentEntityAccess(variable, authData, true);
          return await this.getVariableValue(variable, obj['path']);
        }
      } else {
        for (const key of Object.keys(obj)) {
          const value = obj[key];
          obj[key] = await this.unwrapVariables(authData, value, checkVariableAccess);
        }
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

  private async resolveVisibility(
    tenant: Tenant,
    environment: Environment,
    variable: WithTenant<Variable>,
  ): Promise<WithTenant<Variable> & {hidden: boolean}> {
    const {
      defaultHidden = false,
      visibleContexts = null,
    } = await this.configVariableService.getEffectiveValue<PublicVisibilityValue>(
      ConfigVariableName.PublicVisibility,
      tenant.id,
      environment.id,
    ) || {};

    return {
      ...variable,
      hidden: !this.commonService.isPublicVisibilityAllowed(variable, defaultHidden, visibleContexts),
    };
  }
}

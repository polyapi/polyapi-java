import { ConflictException, forwardRef, HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { CustomFunction, Environment, Tenant, WebhookHandle } from '@prisma/client';
import { CommonService } from 'common/common.service';
import { PrismaService } from 'prisma-module/prisma.service';
import { EventService } from 'event/event.service';
import { AiService } from 'ai/ai.service';
import {
  ConfigVariableName,
  PropertySpecification,
  PropertyType,
  PublicVisibilityValue,
  TrainingDataGeneration,
  Visibility,
  VisibilityQuery,
  WebhookHandleBasicDto,
  WebhookHandleBasicPublicDto,
  WebhookHandleDto,
  WebhookHandlePublicDto,
  WebhookHandleSpecification,
  WebhookSecurityFunction,
} from '@poly/model';
import { ConfigService } from 'config/config.service';
import { SpecsService } from 'specs/specs.service';
import { toCamelCase } from '@guanghechen/helper-string';
import { ConfigVariableService } from 'config-variable/config-variable.service';
import { TriggerService } from 'trigger/trigger.service';
import { WithSecurityFunctions, WithTenant } from 'common/types';
import { FunctionService } from 'function/function.service';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly commonService: CommonService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
    private readonly aiService: AiService,
    @Inject(forwardRef(() => SpecsService))
    private readonly specsService: SpecsService,
    private readonly configVariableService: ConfigVariableService,
    private readonly triggerService: TriggerService,
    @Inject(forwardRef(() => FunctionService))
    private readonly functionService: FunctionService,
  ) {}

  public async findWebhookHandle(id: string): Promise<WebhookHandle | null> {
    return this.prisma.webhookHandle.findFirst({
      where: {
        id,
      },
    });
  }

  public async getWebhookHandles(
    environmentId: string,
    contexts?: string[],
    names?: string[],
    ids?: string[],
    visibilityQuery?: VisibilityQuery,
    includeTenant = false,
  ): Promise<WebhookHandle[]> {
    this.logger.debug(`Getting webhook handles for environment ${environmentId}...`);
    return this.prisma.webhookHandle.findMany({
      where: {
        AND: [
          {
            OR: [
              { environmentId },
              visibilityQuery ? this.commonService.getVisibilityFilterCondition(visibilityQuery) : {},
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

  public async getWebhookHandle(id: string, environment: Environment) {
    return this.prisma.webhookHandle.findFirst({
      where: {
        id,
      },
      include: {
        environment: true,
        customFunctions: {
          select: {
            message: true,
            customFunction: {
              select: {
                id: true,
                environmentId: true,
              },
            },
          },
          where: {
            customFunction: {
              environmentId: environment.id,
            },
          },
        },
      },
    });
  }

  public async getPublicWebhookHandles(tenant: Tenant, environment: Environment, includeHidden = false) {
    const handles = await this.prisma.webhookHandle.findMany({
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
      include: {
        environment: {
          include: {
            tenant: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return (await Promise.all(handles.map((handle) => this.resolveVisibility(tenant, environment, handle)))).filter(
      (handle) => includeHidden || !handle.hidden,
    );
  }

  async findPublicWebhookHandle(tenant: Tenant, environment: Environment, id: string) {
    const handle = await this.prisma.webhookHandle.findFirst({
      where: {
        id,
        visibility: Visibility.Public,
        environment: {
          tenant: {
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
        customFunctions: {
          select: {
            customFunction: {
              select: {
                id: true,
                environmentId: true,
              },
            },
            message: true,
          },
          where: {
            customFunction: {
              environmentId: environment.id,
            },
          },
        },
      },
    });

    if (!handle) {
      return null;
    }

    return await this.resolveVisibility(tenant, environment, handle);
  }

  private async getAIWebhookData(webhookHandle: WebhookHandle, description: string, eventPayload: any) {
    const environment = await this.prisma.environment.findUniqueOrThrow({ where: { id: webhookHandle.environmentId } });
    const tenantId = environment.tenantId;
    const {
      name: aiName,
      description: aiDescription,
      context: aiContext,
    } = await this.aiService.getWebhookDescription(
      tenantId,
      `${this.config.hostUrl}/webhooks/${webhookHandle?.id}`,
      description,
      JSON.stringify(eventPayload),
    );

    return {
      name: aiName,
      description: aiDescription,
      context: aiContext,
    };
  }

  public async createOrUpdateWebhookHandle(
    environment: Environment,
    context: string,
    name: string,
    eventPayload: any | null,
    eventPayloadTypeSchema: Record<string, any> | null,
    description: string,
    visibility?: Visibility,
    responsePayload?: any,
    responseHeaders?: any,
    responseStatus?: number,
    subpath?: string,
    method?: string,
    securityFunctions?: WebhookSecurityFunction[],
    templateBody?: string,
    checkBeforeCreate: () => Promise<void> = async () => undefined,
  ): Promise<WithSecurityFunctions<WebhookHandle>> {
    this.logger.debug(`Creating webhook handle for ${context}/${name}...`);
    if (eventPayload) {
      this.logger.debug(`Event payload: ${JSON.stringify(eventPayload)}`);
    }
    if (eventPayloadTypeSchema) {
      this.logger.debug(`Event payload schema: ${JSON.stringify(eventPayloadTypeSchema)}`);
    }

    const webhookHandle = await this.prisma.webhookHandle.findFirst({
      where: {
        name,
        context,
        environmentId: environment.id,
      },
    });

    name = this.normalizeName(name, webhookHandle);
    context = this.normalizeContext(context, webhookHandle);
    responsePayload = this.normalizeResponsePayload(responsePayload, webhookHandle);
    responseHeaders = this.normalizeResponseHeaders(responseHeaders, webhookHandle);

    if (
      !(await this.checkContextAndNameDuplicates(
        environment.id,
        context,
        name,
        webhookHandle ? [webhookHandle.id] : [],
      ))
    ) {
      throw new ConflictException(`Function with ${context}/${name} is already registered.`);
    }

    const webhookData = {
      eventPayloadType: eventPayloadTypeSchema
        ? JSON.stringify(eventPayloadTypeSchema)
        : await this.getEventPayloadType(templateBody || eventPayload, templateBody ? 'eventPayload' : undefined),
      visibility,
      responsePayload,
      responseHeaders,
      responseStatus,
      subpath,
      method,
      ...(securityFunctions?.length
        ? {
            customFunctions: {
              create: securityFunctions.map(securityFunction => ({
                custom_function_id: securityFunction.id,
                message: securityFunction.message,
              })),
            },
          }
        : null),
    };

    if (webhookHandle) {
      return await this.prisma.$transaction(async trx => {
        this.logger.debug(`Webhook handle found for ${context}/${name} - updating...`);

        if (securityFunctions) {
          await trx.customFunctionWebhookHandle.deleteMany({
            where: {
              webhook_handle_id: webhookHandle.id,
              customFunction: {
                environmentId: environment.id,
              },
            },
          });
        }

        let alreadyUpdated = false;

        if (!name || !context || !description) {
          if (await this.isWebhookAITrainingEnabled(environment)) {
            const aiResponse = await this.getAIWebhookData(
              webhookHandle,
              description,
              eventPayload || eventPayloadTypeSchema,
            );

            await trx.webhookHandle.update({
              where: {
                id: webhookHandle.id,
              },
              data: {
                ...webhookData,
                context: context || this.commonService.sanitizeContextIdentifier(aiResponse.context),
                description: description || aiResponse.description,
                name: name || this.commonService.sanitizeNameIdentifier(aiResponse.name),
              },
            });

            alreadyUpdated = true;
          }
        }

        if (!alreadyUpdated) {
          await trx.webhookHandle.update({
            where: {
              id: webhookHandle.id,
            },
            data: {
              ...webhookData,
              name,
              context,
              description: description || webhookHandle.description,
            },
          });
        }

        return trx.webhookHandle.findFirst({
          where: {
            id: webhookHandle.id,
          },
          include: {
            customFunctions: {
              select: {
                customFunction: {
                  select: {
                    id: true,
                    environmentId: true,
                  },
                },
                message: true,
              },
              where: {
                customFunction: {
                  environmentId: webhookHandle.environmentId,
                },
              },
            },
          },
        }) as Promise<WithSecurityFunctions<WebhookHandle>>;
      });
    } else {
      await checkBeforeCreate();

      this.logger.debug(`Creating new webhook handle in environment ${environment.id} for ${context}/${name}...`);

      return this.prisma.$transaction(
        async (tx) => {
          let webhookHandle = await tx.webhookHandle.create({
            data: {
              environment: {
                connect: {
                  id: environment.id,
                },
              },
              ...webhookData,
              name,
              context: context || '',
              description,
            },
          });

          if (securityFunctions?.length) {
            for (const securityFunction of securityFunctions) {
              await tx.customFunctionWebhookHandle.create({
                data: {
                  custom_function_id: securityFunction.id,
                  message: securityFunction.message,
                  webhook_handle_id: webhookHandle.id,
                },
              });
            }
          }

          if (!name || !description || !context) {
            const trainingDataCfgVariable = await this.configVariableService.getEffectiveValue<TrainingDataGeneration>(
              ConfigVariableName.TrainingDataGeneration,
              environment.tenantId,
              environment.id,
            );

            if (trainingDataCfgVariable?.webhooks) {
              const aiResponse = await this.getAIWebhookData(
                webhookHandle,
                description,
                eventPayload || eventPayloadTypeSchema,
              );

              webhookHandle = await tx.webhookHandle.update({
                where: {
                  id: webhookHandle.id,
                },
                data: {
                  eventPayloadType: eventPayloadTypeSchema
                    ? JSON.stringify(eventPayloadTypeSchema)
                    : await this.getEventPayloadType(
                      templateBody || eventPayload,
                      templateBody ? 'eventPayload' : undefined,
                    ),
                  context: context || this.commonService.sanitizeContextIdentifier(aiResponse.context),
                  description: description || aiResponse.description,
                  name: name || this.commonService.sanitizeNameIdentifier(aiResponse.name),
                },
              });
            }
          }

          return webhookHandle;
        },
        {
          timeout: 30_000,
        },
      );
    }
  }

  async triggerWebhookHandle(
    webhookHandle: WebhookHandle,
    executionEnvironment: Environment | null,
    eventPayload: any,
    eventHeaders: Record<string, any>,
    subpath?: string,
  ) {
    this.logger.debug(`Triggering webhook for ${webhookHandle.id} (subpath=${subpath})...`);

    const subpathParams =
      subpath && webhookHandle.subpath ? await this.resolveSubpathParams(subpath, webhookHandle.subpath) : {};

    const securityFunctions: Parameters<typeof this.executeSecurityFunctions>[0] = (await this.prisma.customFunctionWebhookHandle.findMany({
      where: {
        webhook_handle_id: webhookHandle.id,
        customFunction: {
          environmentId: executionEnvironment?.id || webhookHandle.environmentId,
        },
      },
      include: {
        customFunction: {
          include: {
            environment: true,
          },
        },
      },
    })).map(({ customFunction, message }) => ({
      ...customFunction,
      message,
    }));

    let securityFunctionResponseStatus: number | null = null;
    if (securityFunctions.length) {
      securityFunctionResponseStatus = await this.executeSecurityFunctions(
        securityFunctions,
        executionEnvironment,
        eventPayload,
        eventHeaders,
        subpathParams,
      );
    }

    this.eventService.sendWebhookEvent(
      webhookHandle.id,
      executionEnvironment,
      eventPayload,
      eventHeaders,
      subpathParams,
    );

    const response = await this.triggerService.triggerWebhookEvent(
      executionEnvironment ? executionEnvironment.id : webhookHandle.environmentId,
      webhookHandle.id,
      eventPayload,
      eventHeaders,
      subpathParams,
    );

    if (securityFunctionResponseStatus) {
      if (response) {
        response.statusCode = securityFunctionResponseStatus;
      } else {
        return {
          statusCode: securityFunctionResponseStatus,
          data: null,
        };
      }
    }

    return response;
  }

  private async executeSecurityFunctions(
    securityFunctions: (CustomFunction & { environment: Environment } & { message: string | null })[],
    executionEnvironment: Environment | null,
    eventPayload: any,
    eventHeaders: Record<string, any>,
    params: Record<string, any>,
  ) {
    if (securityFunctions.length === 0) {
      return null;
    }

    this.logger.debug(`Found ${securityFunctions.length} security function(s) - executing for security check...`);
    let responseStatus: number | null = null;
    for (const securityFunction of securityFunctions) {
      const response = await this.functionService.executeServerFunction(
        securityFunction,
        executionEnvironment || securityFunction.environment,
        [eventPayload, eventHeaders, params],
      );
      if (response?.body !== true) {
        throw new HttpException(
          response?.body.message || securityFunction.message,
          response?.statusCode && response.statusCode !== 200 ? response.statusCode : HttpStatus.FORBIDDEN,
        );
      }
      responseStatus = response?.statusCode !== 200 ? response?.statusCode : responseStatus;
    }

    return responseStatus;
  }

  toBasicDto(webhookHandle: WebhookHandle): WebhookHandleBasicDto {
    const visibility = webhookHandle.visibility as Visibility;
    return {
      id: webhookHandle.id,
      name: webhookHandle.name,
      context: webhookHandle.context,
      description: webhookHandle.description,
      visibility,
    };
  }

  toDto(webhookHandle: WithSecurityFunctions<WebhookHandle>, forEnvironment: Environment): WebhookHandleDto {
    const eventPayloadType = JSON.parse(webhookHandle.eventPayloadType);

    return {
      id: webhookHandle.id,
      name: webhookHandle.name,
      context: webhookHandle.context,
      description: webhookHandle.description,
      url:
        webhookHandle.visibility !== Visibility.Environment
          ? `${this.commonService.getHostUrlWithSubdomain(forEnvironment)}/webhooks/${webhookHandle.id}`
          : `${this.config.hostUrl}/webhooks/${webhookHandle.id}`,
      visibility: webhookHandle.visibility as Visibility,
      eventPayloadType: typeof eventPayloadType === 'object' ? 'object' : eventPayloadType,
      eventPayloadTypeSchema: typeof eventPayloadType === 'object' ? eventPayloadType : undefined,
      responsePayload: webhookHandle.responsePayload ? JSON.parse(webhookHandle.responsePayload) : undefined,
      responseHeaders: webhookHandle.responseHeaders ? JSON.parse(webhookHandle.responseHeaders) : undefined,
      responseStatus: webhookHandle.responseStatus,
      subpath: webhookHandle.subpath,
      method: webhookHandle.method,
      securityFunctions: (webhookHandle.customFunctions || []).map(customFunctionWebhookHandle => ({
        id: customFunctionWebhookHandle.customFunction.id,
        ...(customFunctionWebhookHandle.message ? { message: customFunctionWebhookHandle.message } : null),
      })),
      enabled: !webhookHandle.enabled ? false : undefined,
    };
  }

  toPublicDto(
    webhookHandle: WithSecurityFunctions<WithTenant<WebhookHandle>> & { hidden: boolean },
    forEnvironment: Environment,
  ): WebhookHandlePublicDto {
    return {
      ...this.toDto(webhookHandle, forEnvironment),
      context: this.commonService.getPublicContext(webhookHandle),
      tenant: webhookHandle.environment.tenant.name || '',
      hidden: webhookHandle.hidden,
    };
  }

  toBasicPublicDto(
    webhookHandle: WithTenant<WebhookHandle> & { hidden: boolean },
  ): WebhookHandleBasicPublicDto {
    return {
      ...this.toBasicDto(webhookHandle),
      context: this.commonService.getPublicContext(webhookHandle),
      tenant: webhookHandle.environment.tenant.name || '',
      hidden: webhookHandle.hidden,
    };
  }

  async updateWebhookHandle(
    webhookHandle: WebhookHandle,
    context: string | null,
    name: string | null,
    description: string | null,
    visibility: Visibility | null,
    eventPayload: any | undefined,
    eventPayloadType: string | undefined,
    eventPayloadTypeSchema: Record<string, any> | undefined,
    responsePayload: any | null | undefined,
    responseHeaders: any | null | undefined,
    responseStatus: number | null | undefined,
    subpath: string | null | undefined,
    method: string | null | undefined,
    securityFunctions: WebhookSecurityFunction[] | undefined,
    enabled: boolean | undefined,
    templateBody: string | undefined,
  ) {
    name = this.normalizeName(name, webhookHandle);
    context = this.normalizeContext(context, webhookHandle);
    description = this.normalizeDescription(description, webhookHandle);
    visibility = this.normalizeVisibility(visibility, webhookHandle);
    responsePayload = this.normalizeResponsePayload(responsePayload, webhookHandle);
    responseHeaders = this.normalizeResponseHeaders(responseHeaders, webhookHandle);

    if (!(await this.checkContextAndNameDuplicates(webhookHandle.environmentId, context, name, [webhookHandle.id]))) {
      throw new ConflictException(`Function with name ${context}/${name} already exists.`);
    }

    this.logger.debug(
      `Updating webhook for ${webhookHandle.context}/${webhookHandle.name} with context:${context}/name:${name} and description: "${description}"...`,
    );

    return this.prisma.$transaction(async trx => {
      if (securityFunctions) {
        await trx.customFunctionWebhookHandle.deleteMany({
          where: {
            webhook_handle_id: webhookHandle.id,
            customFunction: {
              environmentId: webhookHandle.environmentId,
            },
          },
        });
      }

      await trx.webhookHandle.update({
        where: {
          id: webhookHandle.id,
        },
        data: {
          context: context as string,
          name: name as string,
          description: description as string,
          visibility: visibility as Visibility,
          eventPayloadType: eventPayload
            ? await this.getEventPayloadType(templateBody || eventPayload, templateBody ? 'eventPayload' : undefined)
            : eventPayloadTypeSchema
              ? JSON.stringify(eventPayloadTypeSchema)
              : eventPayloadType
                ? JSON.stringify(eventPayloadType)
                : undefined,
          responsePayload,
          responseHeaders,
          responseStatus,
          subpath,
          method,
          securityFunctions: securityFunctions ? JSON.stringify(securityFunctions) : undefined,
          enabled,
          ...(securityFunctions?.length
            ? {
                customFunctions: {
                  create: securityFunctions.map(securityFunction => ({
                    custom_function_id: securityFunction.id,
                    message: securityFunction.message,
                  })),
                },
              }
            : null),
        },
      });

      return trx.webhookHandle.findFirst({
        where: {
          id: webhookHandle.id,
        },
        include: {
          customFunctions: {
            select: {
              customFunction: {
                select: {
                  id: true,
                  environmentId: true,
                },
              },
              message: true,
            },
            where: {
              customFunction: {
                environmentId: webhookHandle.environmentId,
              },
            },
          },
        },
      }) as Promise<WithSecurityFunctions<WebhookHandle>>;
    });
  }

  private async checkContextAndNameDuplicates(
    environmentId: string,
    context: string,
    name: string,
    excludedIds?: string[],
  ) {
    const functionPath = `${context ? `${context}.` : ''}${name.split('.').map(toCamelCase).join('.')}`;
    const paths = (await this.specsService.getSpecificationPaths(environmentId))
      .filter((path) => excludedIds == null || !excludedIds.includes(path.id))
      .map((path) => path.path);

    return !paths.includes(functionPath);
  }

  private normalizeName(name: string | null, webhookHandle: WebhookHandle | null = null) {
    if (name == null) {
      name = webhookHandle?.name || '';
    }
    return toCamelCase(name);
  }

  private normalizeContext(context: string | null, webhookHandle: WebhookHandle | null = null) {
    if (context == null) {
      context = webhookHandle?.context || '';
    }

    return context.trim();
  }

  private normalizeDescription(description: string | null, webhookHandle?: WebhookHandle) {
    if (description == null) {
      description = webhookHandle?.description || '';
    }

    return description;
  }

  private normalizeVisibility(visibility: Visibility | null, webhookHandle?: WebhookHandle) {
    if (visibility == null) {
      visibility = (webhookHandle?.visibility as Visibility) || Visibility.Environment;
    }

    return visibility;
  }

  private normalizeResponsePayload(
    responsePayload: any,
    webhookHandle: WebhookHandle | null,
  ): string | null | undefined {
    return responsePayload
      ? JSON.stringify(responsePayload)
      : responsePayload === null
        ? null
        : webhookHandle?.responsePayload;
  }

  private normalizeResponseHeaders(
    responseHeaders: any,
    webhookHandle: WebhookHandle | null,
  ): string | null | undefined {
    return responseHeaders
      ? JSON.stringify(responseHeaders)
      : responseHeaders === null
        ? null
        : webhookHandle?.responseHeaders;
  }

  private async isWebhookAITrainingEnabled(environment: Environment) {
    const trainingDataCfgVariable = await this.configVariableService.getEffectiveValue<TrainingDataGeneration>(
      ConfigVariableName.TrainingDataGeneration,
      environment.tenantId,
      environment.id,
    );

    return trainingDataCfgVariable?.webhooks;
  }

  async deleteWebhookHandle(id: string) {
    this.logger.debug(`Deleting webhook ${id}...`);
    return this.prisma.webhookHandle.delete({
      where: {
        id,
      },
    });
  }

  async toWebhookHandleSpecification(webhookHandle: WebhookHandle): Promise<WebhookHandleSpecification> {
    const getEventArgument = async (): Promise<PropertySpecification> => {
      const eventPayloadType = JSON.parse(webhookHandle.eventPayloadType);
      const type: PropertyType =
        typeof eventPayloadType === 'object'
          ? {
              kind: 'object',
              schema: eventPayloadType,
            }
          : {
              kind: 'primitive',
              type: eventPayloadType,
            };

      return {
        name: 'event',
        required: false,
        type,
      };
    };

    return {
      type: 'webhookHandle',
      id: webhookHandle.id,
      name: toCamelCase(webhookHandle.name),
      context: webhookHandle.context,
      description: webhookHandle.description,
      function: {
        arguments: [
          {
            name: 'callback',
            required: true,
            type: {
              kind: 'function',
              spec: {
                arguments: [
                  await getEventArgument(),
                  {
                    name: 'headers',
                    required: false,
                    type: {
                      kind: 'object',
                      typeName: 'Record<string, any>',
                    },
                  },
                  {
                    name: 'params',
                    required: false,
                    type: {
                      kind: 'object',
                      typeName: 'Record<string, any>',
                    },
                  },
                ],
                returnType: {
                  kind: 'void',
                },
                synchronous: true,
              },
            },
          },
        ],
        returnType: {
          kind: 'function',
          name: 'UnregisterWebhookEventListener',
          spec: {
            arguments: [],
            returnType: {
              kind: 'void',
            },
          },
        },
      },
      visibilityMetadata: {
        visibility: webhookHandle.visibility as Visibility,
      },
    };
  }

  async updatePublicWebhookHandle(webhookHandle: WebhookHandle, tenant: Tenant, environment: Environment, securityFunctions?: WebhookSecurityFunction[]) {
    return this.prisma.$transaction(async trx => {
      if (securityFunctions) {
        await trx.customFunctionWebhookHandle.deleteMany({
          where: {
            webhook_handle_id: webhookHandle.id,
            customFunction: {
              environmentId: environment.id,
            },
          },
        });
      }

      await trx.webhookHandle.update({
        where: {
          id: webhookHandle.id,
        },
        data: {
          ...(securityFunctions?.length
            ? {
                customFunctions: {
                  create: securityFunctions.map(securityFunction => ({
                    custom_function_id: securityFunction.id,
                    message: securityFunction.message,
                  })),
                },
              }
            : null),
        },
      });

      const updatedWebhookHandle = await trx.webhookHandle.findFirst({
        where: {
          id: webhookHandle.id,
        },
        include: {
          environment: {
            include: {
              tenant: true,
            },
          },
          customFunctions: {
            select: {
              customFunction: {
                select: {
                  id: true,
                  environmentId: true,
                },
              },
              message: true,
            },
            where: {
              customFunction: {
                environmentId: environment.id,
              },
            },
          },
        },
      });

      return await this.resolveVisibility(tenant, environment, updatedWebhookHandle as NonNullable<typeof updatedWebhookHandle>);
    });
  }

  private async resolveVisibility<T extends WebhookHandle = WebhookHandle>(
    tenant: Tenant,
    environment: Environment,
    webhookHandle: WithTenant<T>,
  ): Promise<WithTenant<T> & { hidden: boolean }> {
    const { defaultHidden = false, visibleContexts = null } =
      (await this.configVariableService.getEffectiveValue<PublicVisibilityValue>(
        ConfigVariableName.PublicVisibility,
        tenant.id,
        environment.id,
      )) || {};

    return {
      ...webhookHandle,
      hidden: !this.commonService.isPublicVisibilityAllowed(webhookHandle, defaultHidden, visibleContexts),
    };
  }

  private async resolveSubpathParams(subpath: string, subpathTemplate: string) {
    const pathTemplate = subpathTemplate.split('?')[0] || '';
    const queryTemplate = subpathTemplate.split('?')[1] || '';
    const path = subpath.split('?')[0] || '';
    const query = subpath.split('?')[1] || '';

    const pathParams = this.extractPathParams(pathTemplate, path);
    const queryParams = this.extractQueryParams(queryTemplate, query);

    return {
      ...pathParams,
      ...queryParams,
    };
  }

  private extractPathParams(template: string, path: string): Record<string, string> {
    const params: Record<string, string> = {};

    if (!template || !path) {
      return params;
    }

    if (template.startsWith('/')) {
      template = template.slice(1);
    }
    if (path.startsWith('/')) {
      path = path.slice(1);
    }

    const templateSegments = template.split('/');
    const pathSegments = path.split('/');

    for (let i = 0; i < templateSegments.length; i++) {
      if (templateSegments[i].startsWith('{') && templateSegments[i].endsWith('}')) {
        const paramName = templateSegments[i].slice(1, -1);
        params[paramName] = pathSegments[i];
      }
    }

    return params;
  }

  private extractQueryParams(template: string, query: string): Record<string, string> {
    const params: Record<string, string> = {};

    if (!template || !query) {
      return params;
    }

    const templateParams = template.split('&');
    const queryParams = new URLSearchParams(query);

    for (const templateParam of templateParams) {
      const [key, value] = templateParam.split('=');
      const paramName = value.slice(1, -1);
      if (queryParams.has(key)) {
        params[paramName] = queryParams.get(key)!;
      }
    }

    return params;
  }

  private async getEventPayloadType(eventPayload: string | Record<string, any>, subpath?: string): Promise<string> {
    const [type, typeSchema] = eventPayload
      ? await this.commonService.resolveType(
        'WebhookEventType',
        typeof eventPayload === 'string' ? eventPayload : JSON.stringify(eventPayload),
        subpath,
      )
      : ['string'];

    return type === 'object' ? JSON.stringify(typeSchema) : JSON.stringify(type);
  }
}

import { ConflictException, forwardRef, Inject, Injectable, Logger } from '@nestjs/common';
import { Environment, Tenant, WebhookHandle } from '@prisma/client';
import { CommonService } from 'common/common.service';
import { PrismaService } from 'prisma/prisma.service';
import { EventService } from 'event/event.service';
import { AiService } from 'ai/ai.service';
import {
  ConfigVariableName,
  PropertySpecification,
  PublicVisibilityValue,
  TrainingDataGeneration,
  Visibility,
  VisibilityQuery,
  WebhookHandleDto,
  WebhookHandlePublicDto,
  WebhookHandleSpecification,
} from '@poly/model';
import { ConfigService } from 'config/config.service';
import { SpecsService } from 'specs/specs.service';
import { toCamelCase } from '@guanghechen/helper-string';
import { ConfigVariableService } from 'config-variable/config-variable.service';
import { TriggerService } from 'trigger/trigger.service';
import { WithTenant } from 'common/types';

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
  ) {
  }

  public async findWebhookHandle(id: string): Promise<WebhookHandle | null> {
    return this.prisma.webhookHandle.findFirst({
      where: {
        id,
      },
    });
  }

  public async getWebhookHandles(environmentId: string, contexts?: string[], names?: string[], ids?: string[], visibilityQuery?: VisibilityQuery, includeTenant = false): Promise<WebhookHandle[]> {
    this.logger.debug(`Getting webhook handles for environment ${environmentId}...`);
    return this.prisma.webhookHandle.findMany({
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

    return (
      await Promise.all(
        handles.map(handle => this.resolveVisibility(tenant, environment, handle)),
      )
    ).filter(handle => includeHidden || !handle.hidden);
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
      },
    });

    if (!handle) {
      return null;
    }

    return await this.resolveVisibility(tenant, environment, handle);
  }

  private async getAIWebhookData(webhookHandle: WebhookHandle, description: string, eventPayload: any) {
    const {
      name: aiName,
      description: aiDescription,
      context: aiContext,
    } = await this.aiService.getWebhookDescription(
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
    eventPayload: any,
    description: string,
    checkBeforeCreate: () => Promise<void> = async () => undefined,
  ): Promise<WebhookHandle> {
    this.logger.debug(`Creating webhook handle for ${context}/${name}...`);
    this.logger.debug(`Event payload: ${JSON.stringify(eventPayload)}`);

    const webhookHandle = await this.prisma.webhookHandle.findFirst({
      where: {
        name,
        context,
        environmentId: environment.id,
      },
    });

    name = this.normalizeName(name, webhookHandle);
    context = this.normalizeContext(context, webhookHandle);

    if (!(await this.checkContextAndNameDuplicates(
      environment.id,
      context,
      name,
      webhookHandle ? [webhookHandle.id] : [])
    )) {
      throw new ConflictException(`Function with ${context}/${name} is already registered.`);
    }

    if (webhookHandle) {
      this.logger.debug(`Webhook handle found for ${context}/${name} - updating...`);

      if (!name || !context || !description) {
        if (await this.isWebhookAITrainingEnabled(environment)) {
          const aiResponse = await this.getAIWebhookData(webhookHandle, description, eventPayload);

          return this.prisma.webhookHandle.update({
            where: {
              id: webhookHandle.id,
            },
            data: {
              eventPayload: JSON.stringify(eventPayload),
              context: context || this.commonService.sanitizeContextIdentifier(aiResponse.context),
              description: description || aiResponse.description,
              name: name || this.commonService.sanitizeNameIdentifier(aiResponse.name),
            },
          });
        }
      }

      return this.prisma.webhookHandle.update({
        where: {
          id: webhookHandle.id,
        },
        data: {
          eventPayload: JSON.stringify(eventPayload),
          name,
          context,
          description: description || webhookHandle.description,
        },
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
              name,
              context: context || '',
              eventPayload: JSON.stringify(eventPayload),
              description,
            },
          });

          if (!name || !description || !context) {
            const trainingDataCfgVariable = await this.configVariableService.getOneParsed<TrainingDataGeneration>(ConfigVariableName.TrainingDataGeneration, environment.tenantId, environment.id);

            if (trainingDataCfgVariable?.value.webhooks) {
              const aiResponse = await this.getAIWebhookData(webhookHandle, description, eventPayload);

              webhookHandle = await tx.webhookHandle.update({
                where: {
                  id: webhookHandle.id,
                },
                data: {
                  eventPayload: JSON.stringify(eventPayload),
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
          timeout: 30000,
        },
      );
    }
  }

  async triggerWebhookHandle(webhookHandle: WebhookHandle, eventPayload: any) {
    this.logger.debug(`Triggering webhook for ${webhookHandle.id}...`);
    this.eventService.sendWebhookEvent(webhookHandle.id, eventPayload);
    await this.triggerService.triggerWebhookEvent(webhookHandle.id, eventPayload);
  }

  toDto(webhookHandle: WebhookHandle): WebhookHandleDto {
    return {
      id: webhookHandle.id,
      name: webhookHandle.name,
      context: webhookHandle.context,
      description: webhookHandle.description,
      url: `${this.config.hostUrl}/webhooks/${webhookHandle.id}`,
      visibility: webhookHandle.visibility as Visibility,
    };
  }

  toPublicDto(webhookHandle: WithTenant<WebhookHandle> & { hidden: boolean }): WebhookHandlePublicDto {
    return {
      ...this.toDto(webhookHandle),
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
  ) {
    name = this.normalizeName(name, webhookHandle);
    context = this.normalizeContext(context, webhookHandle);
    description = this.normalizeDescription(description, webhookHandle);
    visibility = this.normalizeVisibility(visibility, webhookHandle);

    if (!(await this.checkContextAndNameDuplicates(webhookHandle.environmentId, context, name, [webhookHandle.id]))) {
      throw new ConflictException(`Function with name ${context}/${name} already exists.`);
    }

    this.logger.debug(
      `Updating webhook for ${webhookHandle.context}/${webhookHandle.name} with context:${context}/name:${name} and description: "${description}"...`,
    );

    return this.prisma.webhookHandle.update({
      where: {
        id: webhookHandle.id,
      },
      data: {
        context,
        name,
        description,
        visibility,
      },
    });
  }

  private async checkContextAndNameDuplicates(environmentId: string, context: string, name: string, excludedIds?: string[]) {
    const functionPath = `${context ? `${context}.` : ''}${name.split('.').map(toCamelCase).join('.')}`;
    const paths = (await this.specsService.getSpecificationPaths(environmentId))
      .filter(path => excludedIds == null || !excludedIds.includes(path.id))
      .map(path => path.path);

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
      visibility = webhookHandle?.visibility as Visibility || Visibility.Environment;
    }

    return visibility;
  }

  private async isWebhookAITrainingEnabled(environment: Environment) {
    const trainingDataCfgVariable = await this.configVariableService.getOneParsed<TrainingDataGeneration>(ConfigVariableName.TrainingDataGeneration, environment.tenantId, environment.id);

    return trainingDataCfgVariable?.value.webhooks;
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
      const schema =
        (await this.commonService.getJsonSchema('WebhookEventType', webhookHandle.eventPayload)) || undefined;

      return {
        name: 'event',
        required: false,
        type: {
          kind: 'object',
          schema,
        },
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
                arguments: [await getEventArgument()],
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

  private async resolveVisibility(
    tenant: Tenant,
    environment: Environment,
    webhookHandle: WithTenant<WebhookHandle>,
  ): Promise<WithTenant<WebhookHandle> & { hidden: boolean }> {
    const {
      defaultHidden = false,
      visibleContexts = null,
    } = await this.configVariableService.getEffectiveValue<PublicVisibilityValue>(
      ConfigVariableName.PublicVisibility,
      tenant.id,
      environment.id,
    ) || {};

    return {
      ...webhookHandle,
      hidden: !this.commonService.isPublicVisibilityAllowed(webhookHandle, defaultHidden, visibleContexts),
    };
  }
}

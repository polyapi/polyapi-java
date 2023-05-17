import {
  BadRequestException,
  ConflictException,
  forwardRef,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, User, WebhookHandle } from '@prisma/client';
import { HttpService } from '@nestjs/axios';
import { CommonService } from 'common/common.service';
import { PrismaService, PrismaTransaction } from 'prisma/prisma.service';
import { EventService } from 'event/event.service';
import { UserService } from 'user/user.service';
import { AiService } from 'ai/ai.service';
import { PropertySpecification, WebhookHandleDto, WebhookHandleSpecification } from '@poly/common';
import { ConfigService } from 'config/config.service';
import { SpecsService } from 'specs/specs.service';
import { toCamelCase } from '@guanghechen/helper-string';

@Injectable()
export class WebhookService {
  private readonly logger = new Logger(WebhookService.name);

  constructor(
    private readonly commonService: CommonService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly eventService: EventService,
    private readonly aiService: AiService,
    private readonly userService: UserService,
    @Inject(forwardRef(() => SpecsService))
    private readonly specsService: SpecsService,
  ) {}

  private create(data: Omit<Prisma.WebhookHandleCreateInput, 'createdAt'>, tx?: PrismaTransaction): Promise<WebhookHandle> {

    const createData: Parameters<typeof this.prisma.webhookHandle.create>[0] = {
      data: {
        createdAt: new Date(),
        ...data,
      },
    };

    if (tx) {
      return tx.webhookHandle.create(createData);
    }

    return this.prisma.webhookHandle.create(createData);
  }

  private getWebhookFilterConditions(contexts?: string[], names?: string[], ids?: string[]) {
    const contextConditions = contexts?.length
      ? contexts.filter(Boolean).map((context) => {
          return {
            OR: [
              {
                context: { startsWith: `${context}.` },
              },
              {
                context,
              },
            ],
          };
        })
      : [];

    const filterConditions = [
      ...contextConditions,
      names?.length ? { name: { in: names } } : undefined,
      ids?.length ? { id: { in: ids } } : undefined,
    ].filter(Boolean) as any[];

    if (filterConditions.length > 0) {
      this.logger.debug(`webhookHandles filterConditions: ${JSON.stringify(filterConditions)}`);
    }

    return filterConditions.length > 0 ? { OR: [...filterConditions] } : undefined;
  }

  public async findWebhookHandle(id: string): Promise<WebhookHandle | null> {
    return this.prisma.webhookHandle.findFirst({
      where: {
        id,
      },
    });
  }

  public async getWebhookHandles(environmentId: string, contexts?: string[], names?: string[], ids?: string[]): Promise<WebhookHandle[]> {
    this.logger.debug(`Getting webhook handles for environment ${environmentId}...`);

    return this.prisma.webhookHandle.findMany({
      where: {
        environmentId,
        ...this.getWebhookFilterConditions(contexts, names, ids),
      },
      orderBy: {
        createdAt: 'desc',
      },
    });
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
    environmentId: string,
    context: string | null,
    name: string,
    eventPayload: any,
    description: string,
  ): Promise<WebhookHandle> {
    this.logger.debug(`Creating webhook handle for ${context}/${name}...`);
    this.logger.debug(`Event payload: ${JSON.stringify(eventPayload)}`);

    const webhookHandle = await this.prisma.webhookHandle.findFirst({
      where: context === null ? { name } : {
        name,
        context,
        environmentId,
      },
    });

    name = this.normalizeName(name, webhookHandle);
    context = this.normalizeContext(context, webhookHandle);

    if (!(await this.checkContextAndNameDuplicates(
      environmentId,
      context,
      name,
      webhookHandle ? [webhookHandle.id] : [])
    )) {
      throw new ConflictException(`Function with ${context}/${name} is already registered.`);
    }

    if (webhookHandle) {
      this.logger.debug(`Webhook handle found for ${context}/${name} - updating...`);

      if (!name || !context || !description) {
        const aiResponse = await this.getAIWebhookData(webhookHandle, description, eventPayload);

        return this.prisma.webhookHandle.update({
          where: {
            id: webhookHandle.id,
          },
          data: {
            eventPayload: JSON.stringify(eventPayload),
            context: context || aiResponse.context,
            description: description || aiResponse.description,
            name: name || aiResponse.name,
          },
        });
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
      this.logger.debug(`Creating new webhook handle in environment ${environmentId} for ${context}/${name}...`);

      return this.prisma.$transaction(
        async (tx) => {
          let webhookHandle = await this.create(
            {
              environment: {
                connect: {
                  id: environmentId,
                },
              },
              name,
              context: context || '',
              eventPayload: JSON.stringify(eventPayload),
              description,
            },
            tx,
          );

          if (!name || !description || !context) {
            const aiResponse = await this.getAIWebhookData(webhookHandle, description, eventPayload);

            webhookHandle = await tx.webhookHandle.update({
              where: {
                id: webhookHandle.id,
              },
              data: {
                eventPayload: JSON.stringify(eventPayload),
                context: context || aiResponse.context,
                description: description || aiResponse.description,
                name: name || aiResponse.name,
              },
            });
          }

          return webhookHandle;
        },
        {
          timeout: 10000,
        },
      );
    }
  }

  async triggerWebhookHandle(webhookHandle: WebhookHandle, eventPayload: any) {
    this.logger.debug(`Triggering webhook for ${webhookHandle.id}...`);
    this.eventService.sendWebhookEvent(webhookHandle.id, eventPayload);
  }

  toDto(webhookHandle: WebhookHandle): WebhookHandleDto {
    return {
      id: webhookHandle.id,
      name: webhookHandle.name,
      context: webhookHandle.context,
      description: webhookHandle.description,
      url: `${this.config.hostUrl}/webhooks/${webhookHandle.id}`,
    };
  }

  async updateWebhookHandle(
    webhookHandle: WebhookHandle,
    context: string | null,
    name: string | null,
    description: string | null,
  ) {
    name = this.normalizeName(name, webhookHandle);
    context = this.normalizeContext(context, webhookHandle);
    description = this.normalizeDescription(description, webhookHandle);

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
    return name.replace(/[^a-zA-Z0-9.]/g, '');
  }

  private normalizeContext(context: string | null, webhookHandle: WebhookHandle | null = null) {
    if (context == null) {
      context = webhookHandle?.context || '';
    }

    return context.replace(/[^a-zA-Z0-9.]/g, '');
  }

  private normalizeDescription(description: string | null, webhookHandle?: WebhookHandle) {
    if (description == null) {
      description = webhookHandle?.description || '';
    }

    return description;
  }

  async deleteWebhookHandle(id: string) {
    this.logger.debug(`Deleting webhook ${id}...`);
    await this.prisma.webhookHandle.delete({
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
      name: webhookHandle.name,
      context: webhookHandle.context,
      description: '',
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
    };
  }
}

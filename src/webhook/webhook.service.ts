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
import { PrismaService } from 'prisma/prisma.service';
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
  ) {
  }

  private create(data: Omit<Prisma.WebhookHandleCreateInput, 'createdAt'>, tx?: Parameters<Parameters<typeof this.prisma.$transaction>[0]>[0]): Promise<WebhookHandle> {

    const createData: Parameters<typeof this.prisma.webhookHandle.create>[0] = {
      data: {
        createdAt: new Date(),
        ...data,
      }
    }

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

  public async getWebhookHandles(user: User, contexts?: string[], names?: string[], ids?: string[]): Promise<WebhookHandle[]> {
    this.logger.debug(`Getting webhook handles for user ${user?.name}...`);

    const publicUser = await this.userService.getPublicUser();

    return this.prisma.webhookHandle.findMany({
      where: {
        OR: [
          {
            userId: user.id,
          },
          {
            userId: publicUser.id,
          },
        ],
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
      context: aiContext
    }
  }

  public async createOrUpdateWebhookHandle(
    user: User,
    context: string | null,
    name: string,
    eventPayload: any,
    description: string,
  ): Promise<WebhookHandle> {
    

    this.logger.debug(`Creating webhook handle for ${context}/${name}...`);
    this.logger.debug(`Event payload: ${JSON.stringify(eventPayload)}`);

    const webhookHandle = await this.prisma.webhookHandle.findFirst({
      where: context === null ? { name } :  {
        name,
        context,
      },
    });

    name = this.normalizeName(name, webhookHandle);
    context = this.normalizeContext(context, webhookHandle);

    if (!await this.checkContextAndNameDuplicates(user, context, name, webhookHandle ? [webhookHandle.id] : [])) {
      throw new ConflictException(`Function with ${context}/${name} is already registered.`);
    }

    if (webhookHandle) {
      if (webhookHandle.userId !== user.id) {
        throw new ConflictException(`Webhook handle ${context}/${name} is already registered by another user.`);
      }

      this.logger.debug(`Webhook handle found for ${context}/${name} - updating...`);

      if(!name || !context || !description) {
        const aiResponse = await this.getAIWebhookData(webhookHandle, description, eventPayload);

        return this.prisma.webhookHandle.update({
          where: {
            id: webhookHandle.id,
          },
          data: {
            eventPayload: JSON.stringify(eventPayload),
            context: context || aiResponse.context,
            description: description || aiResponse.description,
            name: name || aiResponse.name
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
          description: description || webhookHandle.description
        },
      });
    } else {
      this.logger.debug(`Creating new webhook handle for ${context}/${name}...`);

      return this.prisma.$transaction(async tx => {

        let webhookHandle = await this.create({
          user: {
            connect: {
              id: user.id,
            },
          },
          name,
          context: context || '',
          eventPayload: JSON.stringify(eventPayload),
          description,
        }, tx);
        
        if(!name || !description || !context) {
          const aiResponse = await this.getAIWebhookData(webhookHandle, description, eventPayload);

          webhookHandle = await tx.webhookHandle.update({
            where: {
              id: webhookHandle.id,
            },
            data: {
              eventPayload: JSON.stringify(eventPayload),
              context: context || aiResponse.context,
              description: description || aiResponse.description,
              name: name || aiResponse.name
            },
          });
        }

        return webhookHandle;
      }, {
        timeout: 10000
      });

    }
  }

  async triggerWebhookHandle(id: string, eventPayload: any) {
    this.logger.debug(`Triggering webhook for ${id}...`);
    const webhookHandle = await this.prisma.webhookHandle.findFirst({
      where: {
        id,
      },
    });

    if (!webhookHandle) {
      this.logger.debug(`Webhook handle not found for ${id} - skipping...`);
      return;
    }

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
    user: User,
    id: string,
    context: string | null,
    name: string | null,
    description: string | null,
  ) {
    const webhookHandle = await this.prisma.webhookHandle.findFirst({
      where: {
        id,
        user: {
          id: user.id,
        },
      },
    });
    if (!webhookHandle) {
      throw new NotFoundException(`Webhook handle ${id} not found.`);
    }
    if (name === '') {
      throw new BadRequestException(`Webhook handle name cannot be empty.`);
    }

    name = this.normalizeName(name, webhookHandle);
    context = this.normalizeContext(context, webhookHandle);
    description = this.normalizeDescription(description, webhookHandle);

    if (!await this.checkContextAndNameDuplicates(user, context, name, [webhookHandle.id])) {
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

  private async checkContextAndNameDuplicates(user: User, context: string, name: string, excludedIds?: string[]) {
    const functionPath = `${context ? `${context}.` : ''}${name.split('.').map(toCamelCase).join('.')}`;
    const paths = (await this.specsService.getSpecificationPaths(user))
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

  async deleteWebhookHandle(user: User, id: string) {
    const webhookHandle = await this.prisma.webhookHandle.findFirst({
      where: {
        id,
        user: {
          id: user.id,
        },
      },
    });
    if (!webhookHandle) {
      throw new NotFoundException(`Webhook handle ${id} not found.`);
    }

    this.logger.debug(`Deleting webhook for ${webhookHandle.context}/${webhookHandle.name}...`);
    await this.prisma.webhookHandle.delete({
      where: {
        id: webhookHandle.id,
      },
    });
  }

  async toWebhookHandleSpecification(webhookHandle: WebhookHandle): Promise<WebhookHandleSpecification> {
    const getEventArgument = async (): Promise<PropertySpecification> => {
      const schema = await this.commonService.getJsonSchema('WebhookEventType', webhookHandle.eventPayload) || undefined;

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

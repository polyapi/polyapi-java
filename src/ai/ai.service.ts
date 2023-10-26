import EventSource from 'eventsource';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { catchError, lastValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from 'config/config.service';
import { PrismaService } from 'prisma-module/prisma.service';
import { SystemPrompt, DocSection } from '@prisma/client';
import {
  FunctionDescriptionDto,
  PropertySpecification,
  VariableDescriptionDto,
} from '@poly/model';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  getFunctionCompletion(environmentId: string, userId: string, uuid: string, workspaceFolder = '', language = '') {
    let scienceUrl = `${this.config.scienceServerBaseUrl}/function-completion?user_id=${userId}&environment_id=${environmentId}&question_uuid=${uuid}`;
    if (workspaceFolder) {
      scienceUrl += `&workspace_folder=${workspaceFolder}`;
    }

    if (language) {
      scienceUrl += `&language=${language}`;
    }

    return new EventSource(scienceUrl);
  }

  async pluginChat(apiKey: string, apiKeyId: string, pluginId: number, conversationId: string, message: string): Promise<unknown> {
    this.logger.debug(`Sending message to Science server for plugin chat: ${message}`);
    return await lastValueFrom(
      this.httpService
        .post(`${this.config.scienceServerBaseUrl}/plugin-chat`, {
          apiKey,
          apiKeyId,
          pluginId,
          conversationId,
          message,
        })
        .pipe(map((response) => response.data))
        .pipe(catchError(this.processScienceServerError())),
    );
  }

  async clearConversation(environmentId: string, userId: string) {
    // clears ALL conversations for a user
    this.logger.debug(`Clearing conversation for environment: ${environmentId} ${userId}`);
    await lastValueFrom(
      this.httpService
        .post(`${this.config.scienceServerBaseUrl}/clear-conversations`, {
          environment_id: environmentId,
          user_id: userId,
        })
        .pipe(catchError(this.processScienceServerError())),
    );
  }

  async getFunctionDescription(
    tenantId: string,
    url: string,
    method: string,
    description: string,
    args: PropertySpecification[],
    body: string,
    response: string,
    code?: string,
  ): Promise<FunctionDescriptionDto> {
    this.logger.debug(`Getting description for function: ${url} ${method}`);
    return await lastValueFrom(
      this.httpService
        .post(`${this.config.scienceServerBaseUrl}/function-description`, {
          tenantId,
          url,
          method,
          short_description: description,
          arguments: args,
          payload: body,
          response,
          code,
        })
        .pipe(map((response) => response.data))
        .pipe(catchError(this.processScienceServerError())),
    );
  }

  async getWebhookDescription(tenantId: string, url: string, description: string, payload: string): Promise<FunctionDescriptionDto> {
    this.logger.debug(`Getting description for webhook: ${url} POST`);

    return await lastValueFrom(
      this.httpService
        .post(`${this.config.scienceServerBaseUrl}/webhook-description`, {
          tenantId,
          url,
          method: 'POST',
          short_description: description,
          payload,
        })
        .pipe(map((response) => response.data))
        .pipe(catchError(this.processScienceServerError())),
    );
  }

  async getVariableDescription(
    environmentId: string,
    name: string,
    context: string,
    secret: boolean,
    value: string,
  ): Promise<VariableDescriptionDto> {
    this.logger.debug(`Getting description for variable: ${name}`);

    const environment = await this.prisma.environment.findUniqueOrThrow({ where: { id: environmentId } });
    const tenantId = environment.tenantId;

    return await lastValueFrom(
      this.httpService
        .post(`${this.config.scienceServerBaseUrl}/variable-description`, {
          tenantId,
          name,
          context,
          secret,
          value,
        })
        .pipe(map((response) => response.data))
        .pipe(catchError(this.processScienceServerError())),
    );
  }

  async configure(name: string, value: string) {
    // configure the AI server parameters
    return await lastValueFrom(
      this.httpService
        .post(`${this.config.scienceServerBaseUrl}/configure`, { name, value })
        .pipe(catchError(this.processScienceServerError())),
    );
  }

  private processScienceServerError() {
    return (error) => {
      this.logger.error(`Error while communicating with Science server: ${error}`);
      throw new HttpException(
        error.response?.data || error.message,
        error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    };
  }

  async setSystemPrompt(environmentId: string, userId: string, prompt: string): Promise<SystemPrompt> {
    const systemPrompt = await this.prisma.systemPrompt.findFirst({ orderBy: { createdAt: 'desc' } });
    if (systemPrompt) {
      this.logger.debug(`Found existing SystemPrompt ${systemPrompt.id}. Updating...`);
      return this.prisma.systemPrompt.update({
        where: {
          id: systemPrompt.id,
        },
        data: {
          content: prompt,
        },
      });
    }

    this.logger.debug('Creating new SystemPrompt...');
    return this.prisma.systemPrompt.create({
      data: {
        environmentId,
        content: prompt,
      },
    });
  }

  async updateDocVector(doc: DocSection): Promise<DocSection> {
    const p = new Promise<DocSection>((resolve) => {
      resolve(doc);
    });
    const url = `${this.config.scienceServerBaseUrl}/docs/update-vector`;
    await lastValueFrom(
      this.httpService.post(url, {
        id: doc.id,
      }),
    );
    return p;
  }
}

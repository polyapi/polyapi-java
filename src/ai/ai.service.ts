import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { catchError, lastValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from 'config/config.service';
import { PrismaService } from 'prisma/prisma.service';
import { SystemPrompt, DocSection } from '@prisma/client';
import {
  FunctionCompletionDto,
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

  async getFunctionCompletion(environmentId: string, userId: string, message: string): Promise<FunctionCompletionDto> {
    this.logger.debug(`Sending message to Science server for function completion: ${message}`);
    return await lastValueFrom(
      this.httpService
        .post(`${this.config.scienceServerBaseUrl}/function-completion`, {
          environment_id: environmentId,
          user_id: userId,
          question: message,
        })
        .pipe(
          map((response) => ({
            answer: response.data.answer,
            stats: response.data.stats,
          })),
        )
        .pipe(catchError(this.processScienceServerError())),
    );
  }

  async pluginChat(apiKey: string, pluginId: number, message: string): Promise<string> {
    this.logger.debug(`Sending message to Science server for plugin chat: ${message}`);
    return await lastValueFrom(
      this.httpService
        .post(`${this.config.scienceServerBaseUrl}/plugin-chat`, {
          apiKey,
          pluginId,
          message,
        })
        .pipe(
          map((response) => (response.data.answer)),
        )
        .pipe(catchError(this.processScienceServerError())),
    );
  }

  async clearConversation(environmentId: string, userId: string) {
    this.logger.debug(`Clearing conversation for environment: ${environmentId} ${userId}`);
    await lastValueFrom(
      this.httpService
        .post(`${this.config.scienceServerBaseUrl}/clear-conversation`, {
          environment_id: environmentId,
          user_id: userId,
        })
        .pipe(catchError(this.processScienceServerError())),
    );
  }

  async getFunctionDescription(
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

  async getWebhookDescription(url: string, description: string, payload: string): Promise<FunctionDescriptionDto> {
    this.logger.debug(`Getting description for webhook: ${url} POST`);

    return await lastValueFrom(
      this.httpService
        .post(`${this.config.scienceServerBaseUrl}/webhook-description`, {
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
    name: string,
    context: string,
    secret: boolean,
    value: string,
  ): Promise<VariableDescriptionDto> {
    this.logger.debug(`Getting description for variable: ${name}`);

    return await lastValueFrom(
      this.httpService
        .post(`${this.config.scienceServerBaseUrl}/variable-description`, {
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

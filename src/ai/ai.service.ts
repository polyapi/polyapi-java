import EventSource from 'eventsource';
import { HttpException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { catchError, lastValueFrom, map, Observable } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from 'config/config.service';
import { PrismaService } from 'prisma/prisma.service';
import { SystemPrompt } from '@prisma/client';
import { FunctionDescriptionDto } from '@poly/common';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(
    private readonly httpService: HttpService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  getFunctionCompletion(environmentId: string, userId: string, message: string): Observable<string> {
    this.logger.debug(`Sending message to Science server for function completion: ${message}`);

    const eventSource = new EventSource(`${this.config.scienceServerBaseUrl}/function-completion?user_id=${userId}&environment_id=${environmentId}&question=${message}`);

    return new Observable<string>(subscriber => {
      eventSource.onmessage = (event) => {
        subscriber.next(JSON.parse(event.data).chunk);
      };
      eventSource.onerror = (error) => {
        if (error.message) {
          this.logger.debug(`Error from Science server for function completion: ${error.message}`);
          subscriber.error(error.message);
        }
        subscriber.complete();
        eventSource.close();
      };
    });
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
    body: string,
    response: string,
  ): Promise<FunctionDescriptionDto> {
    this.logger.debug(`Getting description for function: ${url} ${method}`);
    return await lastValueFrom(
      this.httpService
        .post(`${this.config.scienceServerBaseUrl}/function-description`, {
          url,
          method,
          short_description: description,
          payload: body,
          response,
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
      throw new HttpException(error.response?.data || error.message, error.response?.status || HttpStatus.INTERNAL_SERVER_ERROR);
    };
  }

  async setSystemPrompt(environmentId: string, userId: string, prompt: string): Promise<SystemPrompt> {
    // clear the conversation so the user can test the new system prompt!
    await this.clearConversation(environmentId, userId);

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
}

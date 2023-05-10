import { HttpException, Injectable, Logger } from '@nestjs/common';
import { catchError, lastValueFrom, map } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from 'config/config.service';
import { FunctionCompletionDto, FunctionDescriptionDto } from '@poly/common';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly httpService: HttpService, private readonly config: ConfigService) {
  }

  async getFunctionCompletion(userId: number, message: string): Promise<FunctionCompletionDto> {
    this.logger.debug(`Sending message to Science server for function completion: ${message}`);
    return await lastValueFrom(
      this.httpService.post(`${this.config.scienceServerBaseUrl}/function-completion`, {
        user_id: userId,
        question: message,
      }).pipe(
        map(response => ({
          answer: response.data.answer,
          stats: response.data.stats,
        })),
      ).pipe(
        catchError(this.processScienceServerError()),
      ),
    );
  }

  async clearConversation(userId: string) {
    this.logger.debug(`Clearing conversation for user: ${userId}`);
    await lastValueFrom(
      this.httpService.post(`${this.config.scienceServerBaseUrl}/clear-conversation`, {
        user_id: userId,
      }).pipe(
        catchError(this.processScienceServerError()),
      ),
    );
  }

  async getFunctionDescription(url: string, method: string, description: string, body: string, response: string): Promise<FunctionDescriptionDto> {
    this.logger.debug(`Getting description for function: ${url} ${method}`);
    return await lastValueFrom(
      this.httpService.post(`${this.config.scienceServerBaseUrl}/function-description`, {
        url,
        method,
        short_description: description,
        payload: body,
        response,
      }).pipe(
        map(response => response.data),
      ).pipe(
        catchError(this.processScienceServerError()),
      ),
    );
  }

  async getWebhookDescription(url: string, description: string, payload: string): Promise<FunctionDescriptionDto> {
    this.logger.debug(`Getting description for webhook: ${url} POST`);

    return await lastValueFrom(
      this.httpService.post(`${this.config.scienceServerBaseUrl}/webhook-description`, {
        url,
        method: 'POST',
        short_description: description,
        payload,
      }).pipe(
        map(response => response.data),
      ).pipe(
        catchError(this.processScienceServerError()),
      ),
    );
  }

  async configure(name: string, value: string) {
    // configure the AI server parameters
    return await lastValueFrom(
      this.httpService.post(
        `${this.config.scienceServerBaseUrl}/configure`, {name, value}
      ).pipe(
        catchError(this.processScienceServerError()),
      )
    )
  }

  private processScienceServerError() {
    return error => {
      this.logger.error(`Error while communicating with Science server: ${error}`);
      throw new HttpException(error.response.data, error.response.status);
    };
  }
}

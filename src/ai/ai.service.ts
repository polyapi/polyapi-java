import { HttpException, Injectable, Logger } from '@nestjs/common';
import { catchError, lastValueFrom, map, Observable, Subscriber } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from 'config/config.service';
import { FunctionCompletionDto, FunctionDescriptionDto } from '@poly/common';
import EventSource from 'eventsource';

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly httpService: HttpService, private readonly config: ConfigService) {
  }

  getFunctionCompletion(userId: number, message: string): Observable<string> {
    this.logger.debug(`Sending message to Science server for function completion: ${message}`);

    const eventSource = new EventSource(`${this.config.scienceServerBaseUrl}/function-completion?user_id=${userId}&question=${message}`);

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

  async configure(name: string, value: string) {
    // configure the AI server parameters
    return await lastValueFrom(
      this.httpService.post(
        `${this.config.scienceServerBaseUrl}/configure`, { name, value },
      ).pipe(
        catchError(this.processScienceServerError()),
      ),
    );
  }

  private processScienceServerError() {
    return error => {
      this.logger.error(`Error while communicating with Science server: ${error}`);
      throw new HttpException(error.response.data, error.response.status);
    };
  }
}

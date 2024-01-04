import { ArgumentsHost, Catch, ExceptionFilter, HttpException } from '@nestjs/common';
import { Response } from 'express';

/**
 * If return type is `null`, status message won't be replaced.
 */
type StatusMessageReplacer = (exception: HttpException) => string | null;

/**
There is an issue with `https://www.npmjs.com/package/eventsource`, we are not able to retrieve json payload on `error` event in client side (not implemented by library).
 * We only have access to the event object that is of type `{ type: string, status: number, message: string }`.
 * The `message` key contains the http status message string. Because of that, if we override `statusMessage` key from `response` object, we are able
 * to receive custom message errors from server, with this exception filter we are able to send custom message errors to clients that are using `eventsource` library.
 */
@Catch(HttpException)
export class SseExceptionFilter implements ExceptionFilter {
  constructor(private readonly statusMessageReplacer: StatusMessageReplacer = () => null) {}

  catch(exception: HttpException, host: ArgumentsHost) {
    const context = host.switchToHttp();

    const response = context.getResponse() as Response;

    const newStatusMessage = this.statusMessageReplacer(exception);

    if (newStatusMessage) {
      response.statusMessage = newStatusMessage;
    }

    response.status(exception.getStatus()).end();
  }
}

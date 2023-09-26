import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable } from 'rxjs';
import { PrismaService } from 'prisma/prisma.service';
import { PerfLogInfoProvider } from 'statistics/perf-log-info-provider';
import { PerfLogType } from 'statistics/perf-log-type';
import { PERF_LOG_KEY } from 'statistics/perf-log.decorator';

@Injectable()
export class PerfLogInterceptor implements NestInterceptor {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly perfLogProvider: PerfLogInfoProvider,
    private readonly reflector: Reflector,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const type = this.reflector.get<PerfLogType>(PERF_LOG_KEY, context.getHandler());

    if (type) {
      const start = Date.now();
      const request = context.switchToHttp().getRequest();
      const response = context.switchToHttp().getResponse();
      const inputLength = request.body ? JSON.stringify(request.body).length : 0;

      response.on('finish', async () => {
        const duration = Date.now() - start;

        await this.prismaService.perfLog.create({
          data: {
            type,
            start: new Date(start),
            duration,
            inputLength,
            outputLength: response.get('Content-Length') ? parseInt(response.get('Content-Length'), 10) : 0,
            applicationId: request.user?.application?.id,
            userId: request.user?.user?.id,
            snippet: this.perfLogProvider.snippet || '',
            data: this.perfLogProvider.data ? JSON.stringify(this.perfLogProvider.data) : undefined,
          },
        });
      });
    }

    return next.handle();
  }
}

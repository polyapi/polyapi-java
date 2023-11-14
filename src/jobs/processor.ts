import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';
import Bull, { DoneCallback } from 'bull';
import { PrismaService } from 'prisma-module/prisma.service';
import { Job } from '@prisma/client';
import { FunctionJob, FunctionsExecutionType } from '@poly/model';
import { FunctionService } from 'function/function.service';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';
import { ConsoleLogger, Logger } from '@nestjs/common';

type JobFunctionCallResult = { statusCode: number | undefined, id: string, fatalErr: boolean };
type ServerFunctionResult = Awaited<ReturnType<FunctionService['executeServerFunction']>>;

/* eslint-disable no-dupe-class-members, @typescript-eslint/no-unused-vars, @typescript-eslint/no-empty-function  */
class ProcessorLogger extends ConsoleLogger {
  log(message: any, context?: string | undefined): void;
  log(message: any, ...optionalParams: any[]): void;
  log(message: unknown, context?: unknown, ...rest: unknown[]): void {}

  verbose(message: any, context?: string | undefined): void;
  verbose(message: any, ...optionalParams: any[]): void;
  verbose(message: unknown, context?: unknown, ...rest: unknown[]): void {}

  error(message: any, stack?: string | undefined, context?: string | undefined): void;
  error(message: any, ...optionalParams: any[]): void;
  error(message: unknown, stack?: unknown, context?: unknown, ...rest: unknown[]): void {
    if (this.isProcessorLogger()) {
      return super.error(message, context, ...rest);
    }
  }

  debug(message: any, context?: string | undefined): void;
  debug(message: any, ...optionalParams: any[]): void;
  debug(message: unknown, context?: unknown, ...rest: unknown[]): void {
    if (this.isProcessorLogger()) {
      return super.debug(message, ...rest);
    }
  }

  isProcessorLogger() {
    return this.context === 'Processor';
  }
}

/* eslint-enable  no-dupe-class-members */

export default async function (queueJob: Bull.Job<Job>, cb: DoneCallback) {
  try {
    const job = queueJob.data;

    const logger = new ProcessorLogger('Processor');
    logger.debug(`Processing job "${job.name}" with id "${job.id}"`);

    const app = await NestFactory.createApplicationContext(AppModule, {
      logger: new ProcessorLogger(),
    });

    const prisma = app.get(PrismaService);
    const functionService = app.get(FunctionService);
    const httpService = app.get(HttpService);

    const [environment, jobStillExist] = await Promise.all([
      prisma.environment.findFirst({
        where: {
          id: job.environmentId,
        },
      }), prisma.job.findFirst({
        where: {
          id: job.id,
        },
      }),
    ]);

    if (!environment) {
      throw new Error(`Environment not found for job "${job.name}" with id "${job.id}".`);
    }

    if (!jobStillExist) {
      // TODO: remove job from bull.
    }

    const functions = JSON.parse(job.functions) as FunctionJob[];

    const [customFunctions, notFoundFunctions] = await functionService.retrieveFunctions(environment, functions);

    if (notFoundFunctions.length) {
      throw new Error(`Job won't be executed since functions ${notFoundFunctions.join(', ')} are not found.`);
    }

    const parallelExecutions = job.functionsExecutionType === FunctionsExecutionType.SEQUENTIAL;

    const executions: ReturnType<FunctionService['executeServerFunction']>[] = [];

    const results: JobFunctionCallResult[] = [];

    /* for (const functionExecution of functions) {
      const customFunction = customFunctions.find(customFunction => customFunction.id === functionExecution.id) as CustomFunction;

      const args = [functionExecution.eventPayload || {}, functionExecution.headersPayload || {}, functionExecution.paramsPayload || {}];

      if (!parallelExecutions) {
        let callResult: ServerFunctionResult | null = null;

        try {
          callResult = await functionService.executeServerFunction(customFunction, environment, args);
        } catch (err) {
          results.push({
            statusCode: undefined,
            id: functionExecution.id,
            fatalErr: true,
          });
          logger.error(`Fatal error executing server function "${functionExecution.id}". Stopped sequential execution of job "${job.name}" with id "${job.id}"`, err);
          break;
        }

        results.push({
          statusCode: callResult?.statusCode,
          id: functionExecution.id,
          fatalErr: false,
        });

        if (!((callResult?.statusCode || 0) >= HttpStatus.OK && (callResult?.statusCode || 0) < HttpStatus.AMBIGUOUS)) {
          logger.error(`Server function status code result is out of 200's range. Stopped sequential execution of job "${job.name}" with id "${job.id}"`, callResult);

          break;
        }
      } else {
        executions.push(functionService.executeServerFunction(customFunction, environment, args));
      }
    }

    if (parallelExecutions) {
      const parallelResults = await Promise.allSettled(executions);

      for (let i = 0; i < parallelResults.length; i++) {
        const result = parallelResults[i];

        const id = functions[i].id;

        if (result.status === 'fulfilled') {
          results.push({
            statusCode: result.value?.statusCode,
            id,
            fatalErr: false,
          });
        } else {
          results.push({
            id,
            fatalErr: true,
            statusCode: undefined,
          });
        }
      }
    } */

    const response = await lastValueFrom(
      httpService
        .get('http://localhost:3000/delay'),
    );

    // const executionDuration = ((Date.now() - executionStart) / 1000);

    // return results;

    // return {};

    cb(null, results);
  } catch (err) {
    cb(err, null);
  }
}

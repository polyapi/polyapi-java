import { Injectable, Logger, OnModuleDestroy, UnauthorizedException } from '@nestjs/common';
import { FunctionJob, JobDto, FunctionsExecutionType, Schedule, ScheduleType, Visibility, JobStatus, ExecutionDto, JobExecutionStatus } from '@poly/model';
import { CustomFunction, Environment, Job, JobExecution } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import * as cronParser from 'cron-parser';
import dayjs from 'dayjs';
import { FunctionService } from 'function/function.service';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';
import { InjectQueue, OnQueueCompleted, OnQueueFailed, OnQueueProgress, Process, Processor } from '@nestjs/bull';
import Bull, { Queue } from 'bull';
import { CommonService } from 'common/common.service';
import { QUEUE_NAME, JOB_PREFIX } from './constants';
import { type } from 'os';

type ServerFunctionResult = Awaited<ReturnType<FunctionService['executeServerFunction']>>;
type JobFunctionCallResult = { statusCode: number | undefined, id: string, fatalErr: boolean };

@Processor(QUEUE_NAME)
@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly prisma: PrismaService, private readonly functionService: FunctionService, @InjectQueue(QUEUE_NAME) private readonly queue: Queue, private readonly httpService: HttpService, private readonly commonService: CommonService) {

  }

  onModuleDestroy() {
    this.logger.debug('Waiting for in-progress jobs to finish before shutting down...');
    return this.queue.close();
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  private throwMissingScheduleType(schedule: never): never {
    throw new Error('Missing schedule type');
  }

  private async addJobToQueue(job: Job): Promise<Bull.Job<Job>> {
    const schedule = this.getScheduleInfo(job);

    const options: Bull.JobOptions = {
      jobId: job.id,
      removeOnComplete: true,
      removeOnFail: true,
    };

    let result: Bull.Job<Job> | null = null;

    switch (schedule.type) {
      case ScheduleType.INTERVAL: {
        result = await this.queue.add(JOB_PREFIX, job, {
          ...options,
          repeat: {
            every: schedule.value * 60 * 1000, // ms,
          },
        });
        break;
      }

      case ScheduleType.ON_TIME: {
        const difference = dayjs(new Date()).diff(dayjs(schedule.value));

        if (difference > 0) {
          result = await this.queue.add(JOB_PREFIX, job, {
            ...options,
            delay: difference,
          });
        }
        break;
      }

      case ScheduleType.PERIODICAL: {
        result = await this.queue.add(JOB_PREFIX, job, {
          ...options,
          repeat: {
            cron: schedule.value,
          },

        });
        break;
      }

      default:
        this.throwMissingScheduleType(schedule);
    }

    this.logger.debug(`Added job "${job.name}" with id "${job.id}" to queue.`);

    return result as Exclude<typeof result, null>;
  }

  private async removeJobFromQueue(job: Job) {
    const schedule = this.getScheduleInfo(job);

    switch (schedule.type) {
      case ScheduleType.INTERVAL: {
        await this.queue.removeRepeatable(JOB_PREFIX, {
          every: schedule.value * 60 * 1000,
          jobId: job.id,
        });

        break;
      }

      case ScheduleType.PERIODICAL: {
        await this.queue.removeRepeatable(JOB_PREFIX, {
          cron: schedule.value,
          jobId: job.id,
        });

        break;
      }

      case ScheduleType.ON_TIME: {
        const queueJob = await this.queue.getJob(job.id);

        await queueJob?.remove();
        break;
      }

      default:
        this.throwMissingScheduleType(schedule);
    }

    this.logger.debug(`Removed job "${job.name}" with id "${job.id}" from queue.`);
  }

  @Process(JOB_PREFIX)
  private async processJob(queueJob: Bull.Job<Job>) {
    const job = queueJob.data;

    this.logger.debug(`Processing job "${job.name}" with id "${job.id}"`);

    const environment = await this.prisma.environment.findFirst({
      where: {
        id: job.environmentId,
      },
    });

    if (!environment) {
      throw new Error(`Environment not found for job "${job.name}" with id "${job.id}".`);
    }

    const executionStart = Date.now();

    const functions = JSON.parse(job.functions) as FunctionJob[];

    const [customFunctions, notFoundFunctions] = await this.getJobFunctions(environment, functions);

    if (notFoundFunctions.length) {
      throw new Error(`Job won't be executed since functions ${notFoundFunctions.join(', ')} are not found.`);
    }

    const parallelExecutions = job.functionsExecutionType === FunctionsExecutionType.SEQUENTIAL;

    const executions: ReturnType<FunctionService['executeServerFunction']>[] = [];

    const results: JobFunctionCallResult[] = [];
    /*
    for (const functionExecution of functions) {
      const customFunction = customFunctions.find(customFunction => customFunction.id === functionExecution.id) as CustomFunction;

      const args = [functionExecution.eventPayload || {}, functionExecution.headersPayload || {}, functionExecution.paramsPayload || {}];

      if (!parallelExecutions) {
        let callResult: ServerFunctionResult | null = null;

        try {
          callResult = await this.functionService.executeServerFunction(customFunction, job.environment, args);
        } catch (err) {
          results.push({
            statusCode: undefined,
            id: functionExecution.id,
            fatalErr: true,
          });
          this.logger.error(`Fatal error executing server function "${functionExecution.id}". Stopped sequential execution of job "${job.name}" with id "${job.id}"`, err);
          break;
        }

        results.push({
          statusCode: callResult?.statusCode,
          id: functionExecution.id,
          fatalErr: false,
        });

        if (!((callResult?.statusCode || 0) >= HttpStatus.OK && (callResult?.statusCode || 0) < HttpStatus.AMBIGUOUS)) {
          this.logger.error(`Server function status code result is out of 200's range. Stopped sequential execution of job "${job.name}" with id "${job.id}"`, callResult);

          break;
        }
      } else {
        executions.push(this.functionService.executeServerFunction(customFunction, job.environment, args));
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

    /* const response = await lastValueFrom(
      this.httpService
        .get('http://localhost:3000/delay'),
    ); */

    throw new UnauthorizedException('foo');

    // const executionDuration = ((Date.now() - executionStart) / 1000);

    // return results;

    // return {};
  }

  @OnQueueCompleted({
    name: JOB_PREFIX,
  })

  private getQueueJobDuration(queueJob: Bull.Job): number | null {
    let duration: number | null = null;

    if (queueJob.finishedOn && queueJob.processedOn) {
      duration = queueJob.finishedOn - queueJob.processedOn;
    }

    return duration;
  }

  private async onQueueCompleted(queueJob: Bull.Job<Job>, results: JobFunctionCallResult[]) {
    const job = queueJob.data as Job;

    const duration = this.getQueueJobDuration(queueJob);

    this.logger.debug(`Job "${job.name}" with id "${job.id}" processed in ${duration ? `${duration / 1000} seconds` : ''}`);
    this.logger.debug('Results: ', results);

    await this.saveExecutionDetails(job, JobExecutionStatus.FINISHED, results, duration);
  }

  @OnQueueFailed({
    name: JOB_PREFIX,
  })
  private async onQueueFailed(queueJob: Bull.Job<Job>, reason) {
    const job = queueJob.data as Job;

    const duration = this.getQueueJobDuration(queueJob);

    const errMessage = typeof reason === 'string' ? reason : reason?.message;

    this.logger.error(`Failed to save execution record from job "${job.name}" with id "${job.id}", reason: ${errMessage}`);

    await this.saveExecutionDetails(job, JobExecutionStatus.JOB_ERROR, [], duration);
  }

  private async saveExecutionDetails(job: Job, status: JobExecutionStatus, results: JobFunctionCallResult[], duration: number | null = null) {
    try {
      await this.prisma.$transaction(async trx => {
        // Check if job still exists, if not, avoid saving execution info.
        const savedJob = await trx.job.findFirst({
          where: {
            id: job.id,
          },
        });
        if (savedJob) {
          return this.prisma.jobExecution.create({
            data: {
              jobId: job.id,
              duration,
              results: JSON.stringify(results),
              functions: job.functions,
              type: job.functionsExecutionType,
              status,
            },
          });
        }
      });
    } catch (err) {
      this.logger.error(`Failed to save execution record from job "${job.name}" with id "${job.id}"`, err);
    }
  }

  private getScheduleInfo(job: Job): Schedule {
    return job.scheduleType === ScheduleType.INTERVAL
      ? {
          type: ScheduleType.INTERVAL,
          value: job.scheduleIntervalValue as number,
        }
      : (
          job.scheduleType === ScheduleType.ON_TIME
            ? {
                type: ScheduleType.ON_TIME,
                value: job.scheduleOnTimeValue as Date,
              }
            : {
                type: ScheduleType.PERIODICAL,
                value: job.schedulePeriodicalValue as string,
              }
        );
  }

  /**
   * Get custom functions for job execution.
   * Second element from array are not found functions.
   */
  async getJobFunctions(environment: Environment, jobFunctions: { id: string }[] = []): Promise<[Array<CustomFunction>, Array<string>]> {
    const ids = jobFunctions.map(({ id }) => id);

    const customFunctions = await this.functionService.getServerFunctions(environment.id, undefined, undefined, ids);

    const notFoundFunctions: string[] = [];

    if (customFunctions.length !== jobFunctions.length) {
      for (const jobFunction of jobFunctions) {
        if (!customFunctions.find(currentFunction => currentFunction.id === jobFunction.id || currentFunction.visibility === Visibility.Tenant)) {
          notFoundFunctions.push(jobFunction.id);
        }
      }
    }

    return [customFunctions, notFoundFunctions];
  }

  public toExecutionDto(execution: JobExecution): ExecutionDto {
    return {
      id: execution.id,
      createdAt: execution.createdAt,
      jobId: execution.jobId,
      results: JSON.parse(execution.results),
      duration: execution.duration ? execution.duration / 1000 : null,
      functions: JSON.parse(execution.functions),
      type: execution.type as FunctionsExecutionType,
      status: execution.status as JobExecutionStatus,
    };
  }

  public toJobDto(job: Job): JobDto {
    let nextExecutionAt: Date | null = new Date();

    const schedule: Schedule = this.getScheduleInfo(job);

    if (schedule.type === ScheduleType.PERIODICAL) {
      nextExecutionAt = cronParser.parseExpression(schedule.value).next().toDate();
    }

    if (schedule.type === ScheduleType.ON_TIME) {
      nextExecutionAt = new Date(schedule.value);
    }

    if (schedule.type === ScheduleType.INTERVAL) {
      nextExecutionAt = dayjs(nextExecutionAt).add(schedule.value, 'minutes').toDate();
    }

    return {
      id: job.id,
      functionsExecutionType: job.functionsExecutionType as FunctionsExecutionType,
      functions: JSON.parse(job.functions) as FunctionJob[],
      name: job.name,
      schedule,
      nextExecutionAt,
      environmentId: job.environmentId,
      status: job.status as JobStatus,
    };
  }

  async createJob(environment: Environment, name: string, schedule: Schedule, functions: FunctionJob[], functionsExecutionType: FunctionsExecutionType, status: JobStatus) {
    const scheduleValue: {
      scheduleIntervalValue?: number;
      scheduleOnTimeValue?: Date;
      schedulePeriodicalValue?: string;
    } = {
      scheduleIntervalValue: schedule.type === ScheduleType.INTERVAL ? schedule.value : undefined,
      scheduleOnTimeValue: schedule.type === ScheduleType.ON_TIME ? schedule.value : undefined,
      schedulePeriodicalValue: schedule.type === ScheduleType.PERIODICAL ? schedule.value : undefined,
    };

    return await this.prisma.$transaction(async trx => {
      const createdJob = await trx.job.create({
        data: {
          name,
          scheduleType: schedule.type,
          ...scheduleValue,
          functions: JSON.stringify(functions),
          functionsExecutionType,
          environmentId: environment.id,
          status,
        },
      });

      if (status === JobStatus.ENABLED) {
        await this.addJobToQueue(createdJob);
      }

      this.logger.debug(`Saved ${schedule.type} job "${createdJob.name}" with id "${createdJob.id}"`);

      return createdJob;
    });
  }

  async updateJob(job: Job, name: string | undefined, schedule: Schedule | undefined, functions: FunctionJob[] | undefined, functionsExecutionType: FunctionsExecutionType | undefined, status?: JobStatus) {
    const scheduleValue: {
      scheduleIntervalValue?: number;
      scheduleOnTimeValue?: Date;
      schedulePeriodicalValue?: string;
    } | undefined = schedule
      ? {
          scheduleIntervalValue: schedule.type === ScheduleType.INTERVAL ? schedule.value : undefined,
          scheduleOnTimeValue: schedule.type === ScheduleType.ON_TIME ? schedule.value : undefined,
          schedulePeriodicalValue: schedule.type === ScheduleType.PERIODICAL ? schedule.value : undefined,
        }
      : undefined;

    try {
      return await this.prisma.$transaction(async trx => {
        const disableJob = job.status === JobStatus.ENABLED && status === JobStatus.DISABLED;

        const enableJobAgain = job.status === JobStatus.DISABLED && status === JobStatus.ENABLED;

        const oldJobSchedule = this.getScheduleInfo(job);

        const scheduleChanged = schedule && (schedule.type !== oldJobSchedule.type || (schedule.type === oldJobSchedule.type && schedule.value !== oldJobSchedule.value));

        const shouldRemoveRuntimeJob = !!(scheduleChanged || disableJob);

        if (shouldRemoveRuntimeJob) {
          await this.removeJobFromQueue(job);
        }

        const updatedJob = await trx.job.update({
          where: {
            id: job.id,
          },
          data: {
            name,
            scheduleType: schedule ? schedule.type : undefined,
            ...scheduleValue,
            functions: functions ? JSON.stringify(functions) : undefined,
            functionsExecutionType,
            status,
          },
        });

        if ((shouldRemoveRuntimeJob && status !== JobStatus.DISABLED) || enableJobAgain) {
          await this.addJobToQueue(updatedJob);
        }

        this.logger.debug(`Updated job "${updatedJob.name}" with id "${updatedJob.id}"`);

        return updatedJob;
      });
    } catch (err) {
      this.logger.error(`Err updating job "${job.name}" with id "${job.id}"`, err);

      // We need to restore job in bull if it was deleted in transaction and transaction threw an err after updating it in database.

      const oldSchedule = this.getScheduleInfo(job);

      switch (oldSchedule.type) {
        case ScheduleType.INTERVAL:
        case ScheduleType.PERIODICAL: {
          const repeatableJobs = await this.queue.getRepeatableJobs();

          const repeatableJobInQueue = repeatableJobs.find(repeatableJob => {
            const sameNameAndId = repeatableJob.name === JOB_PREFIX && repeatableJob.id === job.id;

            if (!sameNameAndId) {
              return false;
            }

            if (oldSchedule?.type === ScheduleType.INTERVAL) {
              return repeatableJob.every === oldSchedule.value;
            } else {
              return repeatableJob.cron === oldSchedule.value;
            }
          });

          this.logger.debug('Job was deleted in transaction, restoring...');

          if (!repeatableJobInQueue) {
            await this.addJobToQueue(job);
          }

          break;
        }

        case ScheduleType.ON_TIME: {
          const jobInQueue = await this.queue.getJob(job.id);

          if (!jobInQueue) {
            this.logger.debug('Job was deleted in transaction, restoring...');
            await this.addJobToQueue(job);
          }
          break;
        }

        default:
          this.throwMissingScheduleType(oldSchedule);
      }

      throw err;
    }
  }

  async getJobs(environment: Environment) {
    const jobs = await this.prisma.job.findMany({
      where: {
        environmentId: environment.id,
      },
    });

    return jobs;
  }

  async getJob(environment: Environment, id: string) {
    return this.prisma.job.findFirst({
      where: {
        environmentId: environment.id,
        id,
      },
    });
  }

  async deleteJob(job: Job) {
    await this.prisma.$transaction(async trx => {
      await trx.job.delete({
        where: {
          id: job.id,
        },
      });

      await this.removeJobFromQueue(job);
    });
  }

  async getExecutions(job: Job) {
    return this.prisma.jobExecution.findMany({
      where: {
        jobId: job.id,
      },
    });
  }

  async getExecution(id: string) {
    return this.prisma.jobExecution.findFirst({
      where: {
        id,
      },
    });
  }
}

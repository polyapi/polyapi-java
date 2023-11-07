import { Injectable, OnModuleInit, Logger, OnModuleDestroy } from '@nestjs/common';
import { FunctionJob, JobDto, FunctionsExecutionType, Schedule, ScheduleType, Visibility, JobStatus, ExecutionDto, Jobs } from '@poly/model';
import { CustomFunction, Environment, Job, JobExecution } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import * as cronParser from 'cron-parser';
import { SchedulerRegistry } from '@nestjs/schedule';
import dayjs from 'dayjs';
import { CronJob } from 'cron';
import { FunctionService } from 'function/function.service';
import { delay } from '@poly/common/utils';
import { lastValueFrom } from 'rxjs';
import { HttpService } from '@nestjs/axios';

type ServerFunctionResult = Awaited<ReturnType<FunctionService['executeServerFunction']>>;

@Injectable()
export class JobsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);

  private moduleDestroyLock: Record<string, Promise<void> | undefined> = {};

  constructor(private readonly prisma: PrismaService, private readonly schedulerRegistry: SchedulerRegistry, private readonly functionService: FunctionService, private readonly httpService: HttpService) {

  }

  onModuleDestroy() {
    return this.waitUntilRunningJobsFinish();
  }

  onModuleInit() {
    this.registerRuntimeJobs();
  }

  private async waitUntilRunningJobsFinish() {
    // Clean current incoming jobs.
    for (const intervalId of this.schedulerRegistry.getIntervals()) {
      this.schedulerRegistry.deleteInterval(intervalId);
    }

    for (const timeoutId of this.schedulerRegistry.getTimeouts()) {
      this.schedulerRegistry.deleteTimeout(timeoutId);
    }

    for (const [cronName] of Object.entries(this.schedulerRegistry.getCronJobs())) {
      this.schedulerRegistry.deleteCronJob(cronName);
    }

    const moduleDestroyLock = Object.entries(this.moduleDestroyLock);

    if (moduleDestroyLock.length) {
      this.logger.debug(`Waiting for ${moduleDestroyLock.length} jobs to finish before shutting down...`);
    }

    // Wait for current running jobs to finish.
    for (const [runtimeJobId, jobProcess] of moduleDestroyLock) {
      this.logger.debug(`Waiting for runtime job ${runtimeJobId}...`);
      await jobProcess;
    }

    if (moduleDestroyLock.length) {
      this.logger.debug('All pending jobs have been finished.');
    }
  }

  private async registerRuntimeJobs() {
    try {
      this.logger.debug('Adding jobs into scheduler registry.');

      const jobs = await this.prisma.job.findMany({
        where: {
          AND: [
            {
              status: JobStatus.ENABLED,
            },
            {
              OR: [
                {
                  scheduleType: {
                    not: {
                      equals: ScheduleType.ON_TIME,
                    },
                  },
                }, {
                  scheduleType: ScheduleType.ON_TIME,
                  scheduleOnTimeValue: {
                    gte: new Date(),
                  },
                },
              ],
            },
          ],
        },
      });

      let intervalCount = 0;
      let onTimeCount = 0;
      let periodicalCount = 0;
      for (const job of jobs) {
        switch ((job.scheduleType as ScheduleType)) {
          case ScheduleType.INTERVAL:
            intervalCount++;
            break;

          case ScheduleType.ON_TIME:
            onTimeCount++;
            break;

          case ScheduleType.PERIODICAL:
            periodicalCount++;
            break;
        }

        this.addRuntimeJob(job);
      }

      this.logger.debug(`Added ${intervalCount} interval jobs, ${onTimeCount} on time jobs and ${periodicalCount} periodical jobs to scheduler registry. Total: ${intervalCount + onTimeCount + periodicalCount}`);
    } catch (err) {
      this.logger.error('Failed to register runtime jobs', err);
    }
  }

  private addRuntimeJob(job: Job) {
    const schedule = this.getScheduleInfo(job);

    const runtimeJobIdentifier = this.getRuntimeJobIdentifier(job.id);

    switch (schedule.type) {
      case ScheduleType.INTERVAL: {
        const interval = setInterval(() => this.trackAndExecuteJob(job.id), schedule.value * 60 * 1000);

        this.schedulerRegistry.addInterval(runtimeJobIdentifier, interval);

        break;
      }

      case ScheduleType.ON_TIME: {
        const difference = dayjs(new Date()).diff(dayjs(schedule.value));

        const timeout = setTimeout(() => this.trackAndExecuteJob(job.id), difference);

        this.schedulerRegistry.addTimeout(runtimeJobIdentifier, timeout);

        break;
      }

      case ScheduleType.PERIODICAL: {
        const cronJob = new CronJob(schedule.value, () => this.trackAndExecuteJob(job.id));

        this.schedulerRegistry.addCronJob(runtimeJobIdentifier, cronJob);

        cronJob.start();
        break;
      }
    }
  }

  private deleteRuntimeJob(job: Job) {
    const schedule = this.getScheduleInfo(job);

    const runtimeJobIdentifier = this.getRuntimeJobIdentifier(job.id);

    if (schedule.type === ScheduleType.INTERVAL) {
      this.schedulerRegistry.deleteInterval(runtimeJobIdentifier);
    }

    if (schedule.type === ScheduleType.ON_TIME) {
      this.schedulerRegistry.deleteTimeout(runtimeJobIdentifier);
    }

    if (schedule.type === ScheduleType.PERIODICAL) {
      this.schedulerRegistry.deleteCronJob(runtimeJobIdentifier);
    }

    this.logger.debug(`Removed runtime job "${runtimeJobIdentifier}"`);
  }

  private getRuntimeJob(job: Job) {
    const schedule = this.getScheduleInfo(job);

    const runtimeJobIdentifier = this.getRuntimeJobIdentifier(job.id);

    try {
      if (schedule.type === ScheduleType.INTERVAL) {
        return this.schedulerRegistry.getInterval(runtimeJobIdentifier);
      }

      if (schedule.type === ScheduleType.ON_TIME) {
        return this.schedulerRegistry.getTimeout(runtimeJobIdentifier);
      }

      if (schedule.type === ScheduleType.PERIODICAL) {
        return this.schedulerRegistry.getCronJob(runtimeJobIdentifier);
      }
    } catch (err) {
      return null;
    }
  }

  private getRuntimeJobIdentifier(id: string) {
    return `poly-job-${id}`;
  }

  private trackAndExecuteJob(id: string) {
    const runtimeJobId = this.getRuntimeJobIdentifier(id);

    /*
      eslint-disable no-async-promise-executor
    */
    this.moduleDestroyLock[runtimeJobId] = new Promise(async resolve => {
      try {
        const timeoutInMinutes = 12000; // 1000 * 60 * 5;

        const value = await Promise.race([
          new Promise<string>(async resolve => {
            await delay(timeoutInMinutes);
            resolve('timeout');
          }), this.executeJob(id),
        ]);

        if (value === 'timeout') {
          this.logger.debug(`Job running time was greater than ${timeoutInMinutes} minutes, release module destroy lock.`);
        }
      } catch (err) {
        // Do nothing here.
      }
      resolve();
    });
  }
  /*
    eslint-enable no-async-promise-executor
  */

  private async executeJob(id: string) {
    try {
      const job = await this.prisma.job.findFirst({
        where: {
          id,
        },
        include: {
          environment: true,
        },
      });

      if (!job) {
        return this.logger.error(`Job with id ${id} not found`);
      }
      this.logger.debug(`Executing job ${job?.name} with environment "${job?.environmentId}" and id "${id}"`);

      const executionStart = Date.now();

      const functions = JSON.parse(job.functions) as FunctionJob[];

      const [customFunctions, notFoundFunctions] = await this.getJobFunctions(job.environment, functions);

      if (notFoundFunctions.length) {
        return this.logger.error(`Job won't be executed since functions ${notFoundFunctions.join(', ')} are not found.`);
      }

      const parallelExecutions = job.functionsExecutionType === FunctionsExecutionType.SEQUENTIAL;

      const executions: ReturnType<FunctionService['executeServerFunction']>[] = [];

      const results: { statusCode: number | undefined, id: string, fatalErr: boolean }[] = [];

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

      const response = await lastValueFrom(
        this.httpService
          .get('http://localhost:3000/delay'),
      );

      const executionDuration = ((Date.now() - executionStart) / 1000);

      this.logger.debug(`Job "${job?.name}" with id "${id}" executed. Duration: ${executionDuration} seconds.`);

      try {
        return await this.prisma.jobExecution.create({
          data: {
            jobId: id,
            duration: executionDuration,
            results: JSON.stringify(results),
            functions: JSON.stringify(functions),
            type: job.functionsExecutionType,
          },
        });
      } catch (err) {
        this.logger.error(`Failed to save execution record from job "${job.name}" with id "${job.id}"`, err);
      }
    } catch (err) {
      this.logger.error(`Failed to execute job with id "${id}" failed`, err);
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
      duration: execution.duration,
      functions: JSON.parse(execution.functions),
      type: execution.type as FunctionsExecutionType,
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
        this.addRuntimeJob(createdJob);
        this.logger.debug(`Added new runtime job for job "${createdJob.name}" with id "${createdJob.id}"`);
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
        const enableJobAgain = job.status === JobStatus.DISABLED && status === JobStatus.ENABLED;

        const oldJobSchedule = this.getScheduleInfo(job);

        const scheduleChanged = schedule && (schedule.type !== oldJobSchedule.type || (schedule.type === oldJobSchedule.type && schedule.value !== oldJobSchedule.value));

        const shouldRemoveRuntimeJob = !!(scheduleChanged || status === JobStatus.DISABLED);

        if (this.getRuntimeJob(job) && shouldRemoveRuntimeJob) {
          this.deleteRuntimeJob(job);
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
          this.addRuntimeJob(updatedJob);
          this.logger.debug(`Added new runtime job for job "${job.name}" with id "${job.id}"`);
        }

        this.logger.debug(`Updated job "${updatedJob.name}" with id "${updatedJob.id}"`);

        return updatedJob;
      });
    } catch (err) {
      this.logger.error(`Err updating job "${job.name}" with id "${job.id}"`, err);
      if (!this.getRuntimeJob(job)) {
        this.logger.debug('Restoring old runtime job...');
        this.addRuntimeJob(job);
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

      this.deleteRuntimeJob(job);

      this.logger.debug(`Deleted job "${job.name}" with id "${job.id}"`);
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

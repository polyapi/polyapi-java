import { HttpStatus, Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { FunctionJob, JobDto, FunctionsExecutionType, Schedule, ScheduleType, JobStatus, ExecutionDto, JobExecutionStatus, ExecutionFiltersDto } from '@poly/model';
import { CustomFunction, Environment, Job, JobExecution } from '@prisma/client';
import { PrismaService } from 'prisma-module/prisma.service';
import { FunctionService } from 'function/function.service';
import { HttpService } from '@nestjs/axios';
import { InjectQueue, OnQueueCompleted, OnQueueFailed, Process, Processor } from '@nestjs/bull';
import Bull, { Queue } from 'bull';
import { CommonService } from 'common/common.service';
import { QUEUE_NAME, JOB_PREFIX, JOB_DOES_NOT_EXIST_ANYMORE } from './constants';
import { Cron } from '@nestjs/schedule';

type JobFunctionCallResult = { statusCode: number | undefined, id: string, fatalErr: boolean };
type ServerFunctionResult = Awaited<ReturnType<FunctionService['executeServerFunction']>>;

@Processor(QUEUE_NAME)
@Injectable()
export class JobsService implements OnModuleDestroy {
  private readonly logger = new Logger(JobsService.name);

  constructor(private readonly prisma: PrismaService, private readonly functionService: FunctionService, @InjectQueue(QUEUE_NAME) private readonly queue: Queue<Job>, private readonly httpService: HttpService, private readonly commonService: CommonService) {

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
        const difference = schedule.value.getTime() - new Date().getTime();

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

  private getQueueJobDurationInSeconds(processedOn?: number, finishedOn?: number): number | null {
    let duration: number | null = null;

    if (finishedOn && processedOn) {
      duration = (finishedOn - processedOn) / 1000;
    }

    return duration;
  }

  @OnQueueCompleted({
    name: JOB_PREFIX,
  })
  private async onQueueCompleted(queueJob: Bull.Job<Job>, results: JobFunctionCallResult[] | typeof JOB_DOES_NOT_EXIST_ANYMORE) {
    try {
      if (results === JOB_DOES_NOT_EXIST_ANYMORE) {
        await this.removeJobFromQueue(queueJob.data);
        return;
      }

      const job = queueJob.data as Job;

      const duration = this.getQueueJobDurationInSeconds(queueJob.processedOn, queueJob.finishedOn);

      this.logger.debug(`Job "${job.name}" with id "${job.id}" processed in ${duration ? `${duration} seconds` : ''}`);
      this.logger.debug('Results: ', results);

      const executionStatus: JobExecutionStatus = results.find(result => result.fatalErr || !((result?.statusCode || 0) >= HttpStatus.OK && (result?.statusCode || 0) < HttpStatus.AMBIGUOUS)) ? JobExecutionStatus.WITH_CALL_ERROR : JobExecutionStatus.FINISHED;

      await this.saveExecutionDetails(job, executionStatus, results, queueJob.processedOn, queueJob.finishedOn);
    } catch (err) {
      this.logger.error('Error listening to "OnQueueCompleted" event.', err);
    }
  }

  @Process({
    concurrency: 4,
    name: JOB_PREFIX,
  })
  private async processJob(queueJob: Bull.Job<Job>) {
    try {
      let job = queueJob.data;

      this.logger.debug(`Processing job "${job.name}" with id "${job.id}" asd `);

      const [environment, jobInDb] = await Promise.all([
        this.prisma.environment.findFirst({
          where: {
            id: job.environmentId,
          },
        }), this.prisma.job.findFirst({
          where: {
            id: job.id,
          },
        }),
      ]);

      if (!environment) {
        throw new Error(`Environment not found for job "${job.name}" with id "${job.id}".`);
      }

      if (!jobInDb) {
        this.logger.error('Job does not exist anymore in our database, execution skipped.');
        return JOB_DOES_NOT_EXIST_ANYMORE;
      }

      job = jobInDb;

      this.logger.debug(`Executing job in "${job.functionsExecutionType}" mode...`);

      const functions = JSON.parse(job.functions) as FunctionJob[];

      const [customFunctions, notFoundFunctions] = await this.functionService.retrieveFunctions(environment, functions);

      if (notFoundFunctions.length) {
        throw new Error(`Job won't be executed since functions ${notFoundFunctions.join(', ')} are not found.`);
      }

      const parallelExecutions = job.functionsExecutionType === FunctionsExecutionType.PARALLEL;

      const executions: ReturnType<FunctionService['executeServerFunction']>[] = [];

      const results: JobFunctionCallResult[] = [];

      for (const functionExecution of functions) {
        const customFunction = customFunctions.find(customFunction => customFunction.id === functionExecution.id) as CustomFunction;

        const args = [functionExecution.eventPayload || {}, functionExecution.headersPayload || {}, functionExecution.paramsPayload || {}];

        if (!parallelExecutions) {
          let callResult: ServerFunctionResult | null = null;

          try {
            callResult = await this.functionService.executeServerFunction(customFunction, environment, args);
          } catch (err) {
            results.push({
              id: functionExecution.id,
              statusCode: undefined,
              fatalErr: true,
            });
            this.logger.error(`Fatal error executing server function "${functionExecution.id}". Stopped sequential execution of job "${job.name}" with id "${job.id}"`, err);
            break;
          }

          results.push({
            id: functionExecution.id,
            statusCode: callResult?.statusCode,
            fatalErr: false,
          });

          if (!((callResult?.statusCode || 0) >= HttpStatus.OK && (callResult?.statusCode || 0) < HttpStatus.AMBIGUOUS)) {
            this.logger.error(`Server function status code result is out of 200's range. Stopped sequential execution of job "${job.name}" with id "${job.id}"`, callResult);

            break;
          }
        } else {
          executions.push(this.functionService.executeServerFunction(customFunction, environment, args));
        }
      }

      if (parallelExecutions) {
        const parallelResults = await Promise.allSettled(executions);

        for (let i = 0; i < parallelResults.length; i++) {
          const result = parallelResults[i];

          const id = functions[i].id;

          if (result.status === 'fulfilled') {
            results.push({
              id,
              statusCode: result.value?.statusCode,
              fatalErr: false,
            });
          } else {
            results.push({
              id,
              statusCode: undefined,
              fatalErr: true,
            });
          }
        }
      }

      return results;
    } catch (err) {
      this.logger.error('err: ', err);
      throw err;
    }
  }

  @OnQueueFailed({
    name: JOB_PREFIX,
  })
  private async onQueueFailed(queueJob: Bull.Job<Job>, reason) {
    try {
      const job = queueJob.data as Job;

      const errMessage = typeof reason === 'string' ? reason : reason?.message;

      this.logger.error(`Failed to save execution record from job "${job.name}" with id "${job.id}", reason: ${errMessage}`);

      const executions = await this.prisma.jobExecution.findMany({
        where: {
          jobId: queueJob.data.id,
        },
        orderBy: {
          processedOn: 'desc',
        },
        take: 3,
      });

      if (executions.length === 3 && executions.every(execution => execution.status === JobExecutionStatus.JOB_ERROR)) {
        this.logger.error(`Last 3 executions have "${JobExecutionStatus.JOB_ERROR}" status, disabling job...`);
        await this.updateJob(job, undefined, undefined, undefined, undefined, JobStatus.DISABLED);
      }

      await this.saveExecutionDetails(job, JobExecutionStatus.JOB_ERROR, [], queueJob.processedOn, queueJob.finishedOn);
    } catch (err) {
      this.logger.error('Error listening to "OnQueueFailed" event.', err);
    }
  }

  private async saveExecutionDetails(job: Job, status: JobExecutionStatus, results: JobFunctionCallResult[], processedOn?: number, finishedOn?: number) {
    try {
      await this.prisma.$transaction(async trx => {
        const savedJob = await trx.job.findFirst({
          where: {
            id: job.id,
          },
        });
        if (savedJob) {
          return this.prisma.jobExecution.create({
            data: {
              jobId: job.id,
              results: JSON.stringify(results),
              functions: job.functions,
              type: job.functionsExecutionType,
              status,
              ...(processedOn ? { processedOn: new Date(processedOn) } : null),
              ...(finishedOn ? { finishedOn: new Date(finishedOn) } : null),
              schedule: JSON.stringify(this.getScheduleInfo(job)),
            },
          });
        }
      });
    } catch (err) {
      this.logger.error(`Failed to save execution record from job "${job.name}" with id "${job.id}"`, err);
    }
  }

  private getScheduleInfo(job: Job): Schedule {
    const type = job.scheduleType as ScheduleType;
    switch (type) {
      case ScheduleType.INTERVAL:
        return {
          type: ScheduleType.INTERVAL,
          value: job.scheduleIntervalValue as number,
        };

      case ScheduleType.PERIODICAL:
        return {
          type: ScheduleType.PERIODICAL,
          value: job.schedulePeriodicalValue as string,
        };

      case ScheduleType.ON_TIME:
        return {
          type: ScheduleType.ON_TIME,
          value: job.scheduleOnTimeValue as Date,
        };
      default:
        this.throwMissingScheduleType(type);
    }
  }

  private matchRepeatableJob(repeatableJob: Bull.JobInformation, job: Job) {
    const schedule = this.getScheduleInfo(job);
    const sameNameAndId = repeatableJob.name === JOB_PREFIX && repeatableJob.id === job.id;

    if (!sameNameAndId) {
      return false;
    }

    if (schedule?.type === ScheduleType.INTERVAL) {
      return repeatableJob.every === schedule.value * 60 * 1000;
    } else {
      return repeatableJob.cron === schedule.value;
    }
  }

  private async getRepeatableJobFromQueue(job: Job) {
    const repeatableJobs = await this.queue.getRepeatableJobs();

    return repeatableJobs.find(repeatableJob => this.matchRepeatableJob(repeatableJob, job));
  }

  @Cron('0 */10 * * * *')
  private async restoreOrphanJobs() {
    try {
      this.logger.debug('Checking orphan jobs...');
      const [queueJobs, repeatableJobs] = await Promise.all([
        this.queue.getJobs(['delayed', 'active', 'waiting', 'completed', 'failed', 'paused']),
        this.queue.getRepeatableJobs(),
      ]);

      const jobs = await this.prisma.job.findMany({
        where: {
          status: JobStatus.ENABLED,
        },
      });

      let repeatableJobsRestored = 0;
      let singleJobsRestored = 0;

      for (const job of jobs) {
        const schedule = this.getScheduleInfo(job);

        switch (schedule.type) {
          case ScheduleType.INTERVAL:
          case ScheduleType.PERIODICAL: {
            const foundRepeatable = repeatableJobs.find((repeatableJob) => this.matchRepeatableJob(repeatableJob, job));

            if (!foundRepeatable) {
              this.logger.debug(`job "${job.name}" with id "${job.id}" not found in queue. Restoring...`);
              await this.addJobToQueue(job);
              repeatableJobsRestored++;
            }
            break;
          }
          case ScheduleType.ON_TIME: {
            const foundJob = queueJobs.find(queueJob => queueJob.data.id === job.id);

            if (!foundJob) {
              this.logger.debug(`job "${job.name}" with id "${job.id}" not found in queue. Restoring...`);
              await this.addJobToQueue(job);
              singleJobsRestored++;
            }
            break;
          }

          default:
            this.throwMissingScheduleType(schedule);
        }
      }

      if ((repeatableJobsRestored + singleJobsRestored) > 0) {
        this.logger.debug(`Restored ${repeatableJobsRestored} repeatable jobs and ${singleJobsRestored} single jobs into the queue`);
      } else {
        this.logger.debug('No orphan jobs found.');
      }
    } catch (err) {
      this.logger.error('Failed to run "restoreOrphanJobs" cron.', err);
    }
  }

  private buildScheduleValue(schedule: Schedule) {
    switch (schedule.type) {
      case ScheduleType.INTERVAL:
        return { scheduleIntervalValue: schedule.value };
      case ScheduleType.PERIODICAL:
        return { schedulePeriodicalValue: schedule.value };
      case ScheduleType.ON_TIME:
        return { scheduleOnTimeValue: schedule.value };
      default:
        this.throwMissingScheduleType(schedule);
    }
  }

  public toExecutionDto(execution: JobExecution): ExecutionDto {
    return {
      id: execution.id,
      jobId: execution.jobId,
      results: JSON.parse(execution.results),
      duration: this.getQueueJobDurationInSeconds(execution.processedOn ? execution.processedOn.getTime() : undefined, execution.finishedOn ? execution.finishedOn.getTime() : undefined),
      functions: JSON.parse(execution.functions),
      type: execution.type as FunctionsExecutionType,
      status: execution.status as JobExecutionStatus,
      processedOn: execution.processedOn ? new Date(execution.processedOn) : null,
      finishedOn: execution.finishedOn ? new Date(execution.finishedOn) : null,
      schedule: JSON.parse(execution.schedule) as Schedule,
    };
  }

  public async toJobDto(job: Job): Promise<JobDto> {
    let nextExecutionAt: Date | null = null;

    const schedule: Schedule = this.getScheduleInfo(job);

    switch (schedule.type) {
      case ScheduleType.ON_TIME: {
        const queueJob = await this.queue.getJob(job.id);

        if (queueJob) {
          nextExecutionAt = new Date(queueJob.timestamp + (queueJob.opts.delay as number));
        }
        break;
      }

      case ScheduleType.INTERVAL:
      case ScheduleType.PERIODICAL: {
        const repeatableJob = await this.getRepeatableJobFromQueue(job);

        if (repeatableJob) {
          nextExecutionAt = new Date(repeatableJob.next);
        }

        break;
      }

      default:
        this.throwMissingScheduleType(schedule);
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
    const scheduleValue = this.buildScheduleValue(schedule);

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
    const scheduleValue = schedule ? this.buildScheduleValue(schedule) : undefined;

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
          const repeatableJobInQueue = await this.getRepeatableJobFromQueue(job);

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
      orderBy: {
        createdAt: 'desc',
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

  async getExecutions(job: Job, query: ExecutionFiltersDto) {
    return this.prisma.jobExecution.findMany({
      where: {
        jobId: job.id,
        status: query.status,
      },
      orderBy: {
        createdAt: 'desc',
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

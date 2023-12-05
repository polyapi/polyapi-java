import { BadRequestException, Body, Controller, Delete, Get, NotFoundException, Param, Patch, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthRequest } from 'common/types';
import { ConfigVariableName, CreateJobDto, ExecutionFiltersDto, FunctionJob, JobStatus, Jobs, Schedule, ScheduleType, UpdateJobDto } from '@poly/model';
import { Environment } from '@prisma/client';
import { FunctionService } from 'function/function.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { JobsService } from './jobs.service';
import { ConfigVariableService } from 'config-variable/config-variable.service';
import * as cronParser from 'cron-parser';
import { InvalidIntervalTimeException } from './errors/http';
import { CreateFunctionJob } from '../../packages/model/src/dto/job/utils';

@Controller('jobs')
export class JobsController {
  constructor(private readonly service: JobsService, private readonly functionService: FunctionService, private readonly configVariableService: ConfigVariableService) {

  }

  @Post('')
  @UseGuards(PolyAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createJob(@Req() req: AuthRequest, @Body() data: CreateJobDto) {
    const {
      schedule,
      executionType,
      functions,
      name,
      status = JobStatus.ENABLED,
    } = data;

    await Promise.all([this.checkFunctions(req.user.environment, data.functions), this.checkSchedule(req.user.environment, schedule)]);

    const functionsJob = this.processJobFunctions(functions);

    return this.service.toJobDto(
      await this.service.createJob(req.user.environment, name, schedule, functionsJob, executionType, status),
    );
  }

  @Get('')
  @UseGuards(PolyAuthGuard)
  async getJobs(@Req() req: AuthRequest) {
    const jobs = await this.service.getJobs(req.user.environment);

    return Promise.all(jobs.map(job => this.service.toJobDto(job)));
  }

  @Patch(':id')
  @UseGuards(PolyAuthGuard)
  async updateJob(@Req() req: AuthRequest, @Param('id') id: string, @Body() data: UpdateJobDto) {
    const {
      schedule,
      executionType,
      functions,
      name,
      status,
    } = data;

    if (schedule) {
      await this.checkSchedule(req.user.environment, schedule);
    }

    await this.checkFunctions(req.user.environment, data.functions);

    const job = await this.findJob(req.user.environment, id);
    const functionsJob = functions ? this.processJobFunctions(functions) : functions;

    return this.service.toJobDto(await this.service.updateJob(job, name, schedule, functionsJob, executionType, status));
  }

  @Get(':id')
  @UseGuards(PolyAuthGuard)
  async getJob(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.toJobDto((await this.findJob(req.user.environment, id)));
  }

  @Delete(':id')
  @UseGuards(PolyAuthGuard)
  async deleteJob(@Req() req: AuthRequest, @Param('id') id: string) {
    const job = await this.findJob(req.user.environment, id);

    await this.service.deleteJob(job);
  }

  @Get(':id/executions')
  @UseGuards(PolyAuthGuard)
  async getJobExecutions(@Req() req: AuthRequest, @Param('id') id: string, @Query(new ValidationPipe({
    transform: true,
    forbidNonWhitelisted: true,
    whitelist: true,
  })) filters: ExecutionFiltersDto) {
    const job = await this.findJob(req.user.environment, id);

    return (await this.service.getExecutions(job, filters)).map(execution => this.service.toExecutionDto(execution));
  }

  @Get(':job/executions/:id')
  @UseGuards(PolyAuthGuard)
  async getJobExecution(@Req() req: AuthRequest, @Param('job') jobId: string, @Param('id') id: string) {
    await this.findJob(req.user.environment, jobId);

    return this.service.toExecutionDto(await this.findExecution(id));
  }

  private async checkFunctions(environment: Environment, functions: { id: string }[] = []) {
    const [, notFoundFunctions] = await this.functionService.retrieveFunctions(environment, functions);

    if (notFoundFunctions.length) {
      throw new BadRequestException(`Functions with ids ${notFoundFunctions.join(', ')} not found`);
    }
  }

  private async checkSchedule(environment: Environment, schedule: Schedule) {
    const jobConfig = (await this.configVariableService.getEffectiveValue<Jobs>(ConfigVariableName.Jobs, environment.tenantId, environment.id)) || {
      minimumIntervalTimeBetweenExecutions: 5,
    };

    const { minimumIntervalTimeBetweenExecutions } = jobConfig;

    if (schedule.type === ScheduleType.INTERVAL) {
      if (schedule.value < minimumIntervalTimeBetweenExecutions) {
        throw new InvalidIntervalTimeException(minimumIntervalTimeBetweenExecutions);
      }
    }

    if (schedule.type === ScheduleType.PERIODICAL) {
      const interval = cronParser.parseExpression(schedule.value);

      const firstExecutionDate = interval.next().toDate();

      const secondExecutionDate = interval.next().toDate();

      const intervalMinutes = (secondExecutionDate.getTime() - firstExecutionDate.getTime()) / 1000 / 60;

      if (intervalMinutes < minimumIntervalTimeBetweenExecutions) {
        throw new InvalidIntervalTimeException(minimumIntervalTimeBetweenExecutions);
      }
    }

    if (schedule.type === ScheduleType.ON_TIME) {
      if (schedule.value < new Date()) {
        throw new BadRequestException('Job will not be executed since you passed an old date.');
      }
    }
  }

  private async findJob(environment: Environment, id: string) {
    const job = await this.service.getJob(environment, id);

    if (!job) {
      throw new NotFoundException('Job not found.');
    }

    return job;
  }

  private async findExecution(id: string) {
    const execution = await this.service.getExecution(id);

    if (!execution) {
      throw new NotFoundException('Job not found.');
    }

    return execution;
  }

  private processJobFunctions(functionsJob: CreateFunctionJob[]): FunctionJob[] {
    return functionsJob.map(functionJob => ({
      ...functionJob,
      eventPayload: functionJob.eventPayload || {},
      headersPayload: functionJob.headersPayload || {},
      paramsPayload: functionJob.paramsPayload || {},
    }));
  }
}

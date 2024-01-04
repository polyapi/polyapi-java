import { BadRequestException, Body, Controller, Delete, Get, HttpCode, HttpStatus, Logger, NotFoundException, Param, Patch, Post, Query, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthRequest } from 'common/types';
import { ConfigVariableName, CreateJobDto, ExecutionDto, ExecutionFiltersDto, FunctionJob, CreateFunctionJob, Jobs, Schedule, ScheduleType, UpdateJobDto, Permission } from '@poly/model';
import { Environment } from '@prisma/client';
import { FunctionService } from 'function/function.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { JobsService } from './jobs.service';
import { ConfigVariableService } from 'config-variable/config-variable.service';
import * as cronParser from 'cron-parser';
import { InvalidIntervalTimeException } from './errors/http';
import { AuthService } from 'auth/auth.service';

@Controller('jobs')
export class JobsController {
  private logger: Logger = new Logger(JobsController.name);

  constructor(private readonly service: JobsService, private readonly functionService: FunctionService, private readonly configVariableService: ConfigVariableService, private readonly authService: AuthService) {

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
      enabled = true,
    } = data;

    await Promise.all([this.checkFunctions(req.user.environment, data.functions), this.checkSchedule(req.user.environment, schedule), this.authService.checkPermissions(req.user, [Permission.ManageJobs])]);

    const functionsJob = this.processJobFunctions(functions);

    return this.service.toJobDto(
      await this.service.createJob(req.user.environment, name, schedule, functionsJob, executionType, enabled),
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
      enabled,
    } = data;

    await this.authService.checkPermissions(req.user, [Permission.ManageJobs]);

    if (schedule) {
      await this.checkSchedule(req.user.environment, schedule);
    }

    await this.checkFunctions(req.user.environment, data.functions);

    const job = await this.findJob(req.user.environment, id);
    const functionsJob = functions ? this.processJobFunctions(functions) : functions;

    return this.service.toJobDto(await this.service.updateJob(job, name, schedule, functionsJob, executionType, enabled));
  }

  @Get(':id')
  @UseGuards(PolyAuthGuard)
  async getJob(@Req() req: AuthRequest, @Param('id') id: string) {
    return this.service.toJobDto((await this.findJob(req.user.environment, id)));
  }

  @Delete(':id')
  @UseGuards(PolyAuthGuard)
  async deleteJob(@Req() req: AuthRequest, @Param('id') id: string) {
    await this.authService.checkPermissions(req.user, [Permission.ManageJobs]);

    const job = await this.findJob(req.user.environment, id);

    await this.service.deleteJob(job);
  }

  @Get(':id/executions')
  @UseGuards(PolyAuthGuard)
  async getJobExecutions(@Req() req: AuthRequest, @Param('id') id: string, @Query(new ValidationPipe({
    transform: true,
    forbidNonWhitelisted: true,
    whitelist: true,
  })) filters: ExecutionFiltersDto): Promise<ExecutionDto[]> {
    const job = await this.findJob(req.user.environment, id);

    return (await this.service.getExecutions(job, filters)).map(execution => this.service.toExecutionDto(execution));
  }

  @Get(':job/executions/:id')
  @UseGuards(PolyAuthGuard)
  async getJobExecution(@Req() req: AuthRequest, @Param('job') jobId: string, @Param('id') id: string) {
    await this.findJob(req.user.environment, jobId);

    return this.service.toExecutionDto(await this.findExecution(jobId, id));
  }

  @Delete(':job/executions')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(PolyAuthGuard)
  async deleteJobExecutions(@Req() req: AuthRequest, @Param('job') jobId: string) {
    await this.authService.checkPermissions(req.user, [Permission.ManageJobs]);

    this.logger.debug(`Deleting job executions for job with id "${jobId}"`);

    await this.findJob(req.user.environment, jobId);
    await this.service.deleteJobExecutions(jobId);
  }

  @Delete(':job/executions/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @UseGuards(PolyAuthGuard)
  async deleteJobExecution(@Req() req: AuthRequest, @Param('job') jobId: string, @Param('id') id: string) {
    await this.authService.checkPermissions(req.user, [Permission.ManageJobs]);

    this.logger.debug(`Deleting job execution for job with id "${jobId}" and execution id "${id}"`);
    await this.findJob(req.user.environment, jobId);
    await this.findExecution(jobId, id);
    await this.service.deleteJobExecution(id);
  }

  private async checkFunctions(environment: Environment, functions: { id: string }[] = []) {
    const [, notFoundFunctions] = await this.functionService.retrieveFunctions(environment, functions);

    if (notFoundFunctions.length) {
      throw new BadRequestException(`Functions with ids ${notFoundFunctions.join(', ')} not found`);
    }
  }

  private async checkSchedule(environment: Environment, schedule: Schedule) {
    const jobConfig = (await this.configVariableService.getEffectiveValue<Jobs>(ConfigVariableName.Jobs, environment.tenantId, environment.id)) || {
      minimumExecutionInterval: 5,
    };

    const { minimumExecutionInterval } = jobConfig;

    if (schedule.type === ScheduleType.INTERVAL) {
      if (schedule.value < minimumExecutionInterval) {
        throw new InvalidIntervalTimeException(minimumExecutionInterval);
      }
    }

    if (schedule.type === ScheduleType.PERIODICAL) {
      const interval = cronParser.parseExpression(schedule.value);

      const firstExecutionDate = interval.next().toDate();

      const secondExecutionDate = interval.next().toDate();

      const intervalMinutes = (secondExecutionDate.getTime() - firstExecutionDate.getTime()) / 1000 / 60;

      if (intervalMinutes < minimumExecutionInterval) {
        throw new InvalidIntervalTimeException(minimumExecutionInterval);
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

  private async findExecution(jobId: string, id: string) {
    const execution = await this.service.getExecution(jobId, id);

    if (!execution) {
      throw new NotFoundException('Execution not found.');
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

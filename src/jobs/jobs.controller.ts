import { BadRequestException, Body, ConflictException, Controller, Get, Patch, Post, Req, UseGuards, UsePipes, ValidationPipe } from '@nestjs/common';
import { AuthRequest } from 'common/types';
import { ConfigVariableName, CreateJob, Jobs, Schedule, ScheduleType, Visibility } from '@poly/model';
import { Environment } from '@prisma/client';
import { FunctionService } from 'function/function.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { JobsService } from './jobs.service';
import { ConfigVariableService } from 'config-variable/config-variable.service';
import * as cronParser from 'cron-parser';
import { InvalidIntervalTimeException } from './errors/http';

@Controller('jobs')
export class JobsController {
  constructor(private readonly service: JobsService, private readonly functionService: FunctionService, private readonly configVariableService: ConfigVariableService) {

  }

  @Post('')
  @UseGuards(PolyAuthGuard)
  @UsePipes(new ValidationPipe({ transform: true }))
  async createJob(@Req() req: AuthRequest, @Body() data: CreateJob) {
    const {
      schedule,
      executionType,
      functions,
      name,
    } = data;

    await this.checkFunctions(req.user.environment, data.functions);

    await this.checkSchedule(req.user.environment, schedule);

    return this.service.toJobDto(
      await this.service.createJob(name, schedule, functions, executionType),
    );
  }

    @Get('')
  async getJobs() {}

  @Patch(':id')
    async updateJob() {}

  @Get(':id')
  async getJob() {}

  private async checkFunctions(environment: Environment, functions: { id: string }[] = []) {
    const serverFunctions = await this.functionService.getServerFunctions(environment.id, undefined, undefined, functions.map(({ id }) => id));

    if (serverFunctions.length !== functions.length) {
      for (const securityFunction of functions) {
        if (!serverFunctions.find(serverFunction => serverFunction.id === securityFunction.id || serverFunction.visibility === Visibility.Tenant)) {
          throw new BadRequestException(`Server function with id = ${securityFunction.id} not found`);
        }
      }
    }
  }

  private async checkSchedule(environment: Environment, schedule: Schedule) {
    const jobConfig = await this.configVariableService.getEffectiveValue<Jobs>(ConfigVariableName.Jobs, environment.tenantId, environment.id);

    if (!jobConfig) {
      throw new ConflictException('Jobs config variable is not set in server.');
    }

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
  }
}

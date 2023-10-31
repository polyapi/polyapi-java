import { BadRequestException, Body, Controller, Get, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthRequest } from 'common/types';
import { CreateJob, Visibility } from '@poly/model';
import { Environment } from '@prisma/client';
import { FunctionService } from 'function/function.service';
import { PolyAuthGuard } from 'auth/poly-auth-guard.service';
import { JobsService } from './jobs.service';

@Controller('jobs')
export class JobsController {
  constructor(private readonly service: JobsService, private readonly functionService: FunctionService) {

  }

  @Post('')
  @UseGuards(PolyAuthGuard)
  async createJob(@Req() req: AuthRequest, @Body() data: CreateJob) {
    const {
      scheduleConfig,
      executionType,
      functions,
      name,
    } = data;

    await this.checkFunctions(req.user.environment, data.functions);

    return this.service.toJobDto(
      await this.service.createJob(name, scheduleConfig, functions, executionType),
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
}

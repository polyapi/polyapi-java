import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { AuthRequest } from 'common/types';
import { CreateJob } from '@poly/model';

@Controller('jobs')
export class JobsController {
    @Post('')
  async createJob(@Req() req: AuthRequest, @Body() data: CreateJob) {
    return data;
  }

    @Get('')
    async getJobs() {}

    @Patch(':id')
    async updateJob() {}

    @Get(':id')
    async getJob() {}
}

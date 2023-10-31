import { Injectable } from '@nestjs/common';
import { FunctionJob, Interval, JobDto, JobExecutionType, JobType, OnTime, Periodically } from '@poly/model';
import { Job } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {

  }

  public toJobDto(job: Job): JobDto {
    return {
      id: job.id,
      executionType: job.executionType as JobExecutionType,
      functions: JSON.parse(job.functions) as FunctionJob[],
      name: job.name,
      type: job.type as JobType,
      value: job.value,
    };
  }

  async createJob(name: string, scheduleConfig: Interval | Periodically | OnTime, functions: FunctionJob[], executionType: JobExecutionType) {
    let value = '';

    if (scheduleConfig.type === JobType.INTERVAL) {
      value = JSON.stringify(scheduleConfig.value);
    } else if (scheduleConfig.type === JobType.ON_TIME) {
      value = scheduleConfig.value.toISOString();
    } else {
      value = scheduleConfig.value;
    }

    const job = await this.prisma.job.create({
      data: {
        name,
        type: scheduleConfig.type,
        value,
        functions: JSON.stringify(functions),
        executionType,
      },
    });

    return job;
  }
}

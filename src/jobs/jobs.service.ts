import { Injectable } from '@nestjs/common';
import { FunctionJob, Interval, JobDto, FunctionsExecutionType, ScheduleType, OnTime, Periodical } from '@poly/model';
import { Job } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {

  }

  public toJobDto(job: Job): JobDto {
    return {
      id: job.id,
      functionsExecutionType: job.functionsExecutionType as FunctionsExecutionType,
      functions: JSON.parse(job.functions) as FunctionJob[],
      name: job.name,
      schedule: JSON.parse(job.schedule) as Periodical | OnTime | Interval
    };
  }

  async createJob(name: string, schedule: Interval | Periodical | OnTime, functions: FunctionJob[], functionsExecutionType: FunctionsExecutionType) {
    const job = await this.prisma.job.create({
      data: {
        name,
        schedule: JSON.stringify(schedule),
        functions: JSON.stringify(functions),
        functionsExecutionType,
      },
    });

    return job;
  }
}

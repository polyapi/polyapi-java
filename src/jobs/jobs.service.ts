import { Injectable } from '@nestjs/common';
import { FunctionJob, Interval, JobDto, FunctionsExecutionType, OnTime, Periodical, Schedule, ScheduleType } from '@poly/model';
import { Job } from '@prisma/client';
import { PrismaService } from 'prisma/prisma.service';
import * as cronParser from 'cron-parser';

@Injectable()
export class JobsService {
  constructor(private readonly prisma: PrismaService) {

  }

  public toJobDto(job: Job): JobDto {
    let nextExecutionAt: Date = new Date();

    const schedule: Schedule = job.scheduleType === ScheduleType.INTERVAL
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

    if (schedule.type === ScheduleType.PERIODICAL) {
      nextExecutionAt = cronParser.parseExpression(schedule.value).next().toDate();
    }

    if (schedule.type === ScheduleType.ON_TIME) {
      nextExecutionAt = new Date(schedule.value);
    }

    return {
      id: job.id,
      functionsExecutionType: job.functionsExecutionType as FunctionsExecutionType,
      functions: JSON.parse(job.functions) as FunctionJob[],
      name: job.name,
      schedule,
      nextExecutionAt,
    };
  }

  async createJob(name: string, schedule: Interval | Periodical | OnTime, functions: FunctionJob[], functionsExecutionType: FunctionsExecutionType) {
    const scheduleValue: {
      scheduleIntervalValue?: number;
      scheduleOnTimeValue?: Date;
      schedulePeriodicalValue?: string;
    } = {
      scheduleIntervalValue: schedule.type === ScheduleType.INTERVAL ? schedule.value : undefined,
      scheduleOnTimeValue: schedule.type === ScheduleType.ON_TIME ? schedule.value : undefined,
      schedulePeriodicalValue: schedule.type === ScheduleType.PERIODICAL ? schedule.value : undefined,
    };

    return this.prisma.job.create({
      data: {
        name,
        scheduleType: schedule.type,
        ...scheduleValue,
        functions: JSON.stringify(functions),
        functionsExecutionType,
      },
    });
  }
}

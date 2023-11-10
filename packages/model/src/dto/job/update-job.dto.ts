import { IsArray, IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

import { Type } from 'class-transformer';
import { ScheduleBase, Interval, Periodical, OnTime, CreateFunctionJob } from './utils';
import { FunctionsExecutionType, JobStatus, ScheduleType } from '../../job';

export class UpdateJobDto {
    @IsString()
    @IsOptional()
    name?: string;

    @IsOptional()
    @IsObject()
    @ValidateNested()
    @Type(() => ScheduleBase, {
      keepDiscriminatorProperty: true,
      discriminator: {
        property: 'type',
        subTypes: [
          {
            value: Interval,
            name: ScheduleType.INTERVAL,
          }, {
            value: Periodical,
            name: ScheduleType.PERIODICAL,
          }, {
            value: OnTime,
            name: ScheduleType.ON_TIME,
          },
        ],
      },
    })
    schedule?: Interval | Periodical | OnTime;

    @IsOptional()
    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateFunctionJob)
    functions?: CreateFunctionJob[];

    @IsOptional()
    @IsEnum(FunctionsExecutionType)
    executionType?: FunctionsExecutionType;

    @IsOptional()
    @IsEnum(JobStatus)
    status?: JobStatus;
}

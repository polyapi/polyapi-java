import { IsArray, IsEnum, IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { ScheduleType, FunctionsExecutionType, JobStatus } from '../../job';
import { Type } from 'class-transformer';

import { OnTime, Periodical, Interval, CreateFunctionJob, ScheduleBase } from './utils';
import { ApiModelProperty } from '@nestjs/swagger/dist/decorators/api-model-property.decorator';
import { ApiExtraModels, getSchemaPath } from '@nestjs/swagger';

@ApiExtraModels(Interval, Periodical, OnTime)
export class CreateJobDto {
    @IsString()
    @IsNotEmpty()
    name: string;

    @ApiModelProperty({
      name: 'schedule',
      required: false,
      oneOf: [
        {
          $ref: getSchemaPath(Interval),
        }, {
          $ref: getSchemaPath(Periodical),
        },
        {
          $ref: getSchemaPath(OnTime),
        },
      ],
    })
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
    schedule: Interval | Periodical | OnTime;

    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => CreateFunctionJob)
    functions: CreateFunctionJob[];

    @IsEnum(FunctionsExecutionType)
    executionType: FunctionsExecutionType;

    @IsOptional()
    @IsEnum(JobStatus)
    status?: JobStatus;
}

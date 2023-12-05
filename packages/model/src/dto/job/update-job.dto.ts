import { IsArray, IsEnum, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';

import { Type } from 'class-transformer';
import { ScheduleBase, Interval, Periodical, OnTime, CreateFunctionJob } from './utils';
import { FunctionsExecutionType, JobStatus, ScheduleType } from '../../job';
import { ApiExtraModels, getSchemaPath } from '@nestjs/swagger';
import { ApiModelProperty } from '@nestjs/swagger/dist/decorators/api-model-property.decorator';

@ApiExtraModels(Interval, Periodical, OnTime)
export class UpdateJobDto {
    @IsString()
    @IsOptional()
    name?: string;
    
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

import { ApiModelProperty } from '@nestjs/swagger/dist/decorators/api-model-property.decorator';
import { Type } from 'class-transformer';
import { IsDate, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Validate, ValidationArguments } from 'class-validator';
import { CronExpression, Record } from '../validators';
import { ScheduleType } from '../../job';
import { ApiExtraModels } from '@nestjs/swagger';

const dateErrMsg = (validationArgs: ValidationArguments) => `${validationArgs.property} must be a valid ISO 8601 date string`;

export class ScheduleBase {
    @ApiModelProperty({
      name: 'type',
    })
    @IsString()
    @IsIn([ScheduleType.INTERVAL, ScheduleType.PERIODICAL, ScheduleType.ON_TIME])
    type: ScheduleType;
}

export class OnTime extends ScheduleBase {
    @IsString()
    @ApiModelProperty({
      enum: [ScheduleType.ON_TIME],
    })
    type: ScheduleType.ON_TIME;

    @IsDate({
      message: dateErrMsg,
    })
    @ApiModelProperty()
    @Type(() => Date)
    value: Date;
}

export class Periodical extends ScheduleBase {
    @IsString()
    @ApiModelProperty({
      enum: [ScheduleType.PERIODICAL],
    })
    type: ScheduleType.PERIODICAL;

    @IsString()
    @IsNotEmpty()
    @Validate(CronExpression)
    @ApiModelProperty()
    value: string;
}

export class Interval extends ScheduleBase {
    @IsString()
    @ApiModelProperty({
      name: 'type',
      enum: [ScheduleType.INTERVAL],
    })
    type: ScheduleType.INTERVAL;

    @IsNumber()
    @ApiModelProperty()
    value: number;
}

export class CreateFunctionJob {
    @ApiModelProperty()
    @IsString()
    @IsNotEmpty()
    id: string;

    @ApiModelProperty({
      required: false,
      type: 'object',
      additionalProperties: {
        description: 'Can be anything'
      }
    })
    @IsOptional()
    @IsObject()
    eventPayload?: object;

    @ApiModelProperty({
      required: false,
      type: 'object',
      additionalProperties: {
        type: 'string'
      }
    })
    @IsOptional()
    @Record()
    headersPayload?: object;
    
    @ApiModelProperty({
      required: false,
      type: 'object',
      additionalProperties: {
        type: 'string'
      }
    })
    @IsOptional()
    @Record()
    paramsPayload?: object;
}

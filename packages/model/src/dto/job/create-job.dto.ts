import { IsArray, IsDate, IsDateString, IsEnum, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Validate, ValidateNested, ValidationArguments } from "class-validator";
import { ScheduleType, FunctionsExecutionType } from "../../job";
import { Type } from "class-transformer";
import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";
import { CronExpression } from '../validators';

const dateErrMsg = (validationArgs: ValidationArguments) => `${validationArgs.property} must be a valid ISO 8601 date string`;

class ScheduleBase {
    @ApiModelProperty({
      name: 'type',
    })
    @IsString()
    @IsIn([ScheduleType.INTERVAL, ScheduleType.PERIODICAL, ScheduleType.ON_TIME])
    type: ScheduleType;
}

class OnTime extends ScheduleBase {
    @IsString()
    @ApiModelProperty({
      enum: [ScheduleType.ON_TIME],
    })
    type: ScheduleType.ON_TIME;

    @IsDate({
      message: dateErrMsg
    })
    @ApiModelProperty()
    @Type(() => Date)
    value: Date;
}

class Periodical extends ScheduleBase {
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

class Interval extends ScheduleBase {
    @IsString()
    @ApiModelProperty({
      enum: [ScheduleType.INTERVAL],
    })
    type: ScheduleType.INTERVAL;

    @IsNumber()
    @ApiModelProperty()
    value: number;
}


export class FunctionJob {
  @IsString()
  @IsNotEmpty()
  id: string;
  
  @IsOptional()
  @IsObject()
  eventPayload: object;

  @IsOptional()
  @IsObject()
  headersPayload: object;

  @IsOptional()
  @IsObject()
  paramsPayload: object;
  
}

export class CreateJob {

    @IsString()
    @IsNotEmpty()
    name: string;

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
    @Type(() => FunctionJob)
    functions: FunctionJob[]

    @IsEnum(FunctionsExecutionType)
    executionType: FunctionsExecutionType;
}
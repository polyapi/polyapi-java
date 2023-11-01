import { IsArray, IsEnum, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { ScheduleType, FunctionsExecutionType } from "../../job";
import { Type } from "class-transformer";
import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";


class Options {
    @ApiModelProperty({
      name: 'type',
    })
    @IsString()
    @IsIn([ScheduleType.INTERVAL, ScheduleType.PERIODICAL, ScheduleType.ON_TIME])
    type: ScheduleType;
}

export class OnTime extends Options {
    @IsString()
    @ApiModelProperty({
      enum: [ScheduleType.ON_TIME],
    })
    type: ScheduleType.ON_TIME;

    @IsString()
    @ApiModelProperty()
    @Type(() => Date)
    value: Date;
}

export class Periodical extends Options {
    @IsString()
    @ApiModelProperty({
      enum: [ScheduleType.PERIODICAL],
    })
    type: ScheduleType.PERIODICAL;

    @IsString()
    @ApiModelProperty()
    value: string;
}

export class Interval extends Options {
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
    @Type(() => Options, {
      keepDiscriminatorProperty: true,
      discriminator: {
        property: 'type',
        subTypes: [
          {
            value: Interval,
            name: 'interval',
          }, {
            value: Periodical,
            name: 'periodically',
          }, {
            value: OnTime,
            name: 'ontime',
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
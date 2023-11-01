import { IsArray, IsEnum, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { JobType, JobExecutionType } from "../../job";
import { Type } from "class-transformer";
import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";


class Options {
    @ApiModelProperty({
      name: 'type',
    })
    @IsString()
    @IsIn([JobType.INTERVAL, JobType.PERIODICAL, JobType.ON_TIME])
    type: JobType;
}

export class OnTime extends Options {
    @IsString()
    @ApiModelProperty({
      enum: [JobType.ON_TIME],
    })
    type: JobType.ON_TIME;

    @IsString()
    @ApiModelProperty()
    @Type(() => Date)
    value: Date;
}

export class Periodically extends Options {
    @IsString()
    @ApiModelProperty({
      enum: [JobType.PERIODICAL],
    })
    type: JobType.PERIODICAL;

    @IsString()
    @ApiModelProperty()
    value: string;
}

export class Interval extends Options {
    @IsString()
    @ApiModelProperty({
      enum: [JobType.INTERVAL],
    })
    type: JobType.INTERVAL;

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
            value: Periodically,
            name: 'periodically',
          }, {
            value: OnTime,
            name: 'ontime',
          },
        ],
      },
    })
    scheduleConfig: Interval | Periodically | OnTime;


    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FunctionJob)
    functions: FunctionJob[]

    @IsEnum(JobExecutionType)
    executionType: JobExecutionType;
}
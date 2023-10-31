import { IsArray, IsIn, IsNotEmpty, IsNumber, IsObject, IsString, ValidateNested } from "class-validator";
import { JobType, JobExecutionType } from "../../job";
import { Type } from "class-transformer";
import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";


class BaseJobType {
    @ApiModelProperty({
      name: 'type',
    })
    @IsString()
    @IsIn([JobType.INTERVAL, JobType.PERIODICALLY, JobType.ON_TIME])
    type: JobType;
}

class OnTime extends BaseJobType {
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

class Periodically extends BaseJobType {
    @IsString()
    @ApiModelProperty({
      enum: [JobType.PERIODICALLY],
    })
    type: JobType.PERIODICALLY;

    @IsString()
    @ApiModelProperty()
    value: string;
}

class Interval extends BaseJobType {
    @IsString()
    @ApiModelProperty({
      enum: [JobType.INTERVAL],
    })
    type: JobType.INTERVAL;

    @IsNumber()
    @ApiModelProperty()
    value: number;
}


class FunctionJob {
  @IsString()
  @IsNotEmpty()
  id: string;
  
  eventPayload: object | any[];

  @IsObject()
  headersPayload: object;

  @IsObject()
  paramsPayload: object;
  
}

export class CreateJob {

    @IsString()
    @IsNotEmpty()
    name: string;

    @IsObject()
    @ValidateNested()
    @Type(() => BaseJobType, {
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
    execution: Interval | Periodically | OnTime;


    @IsArray()
    @ValidateNested({ each: true })
    @Type(() => FunctionJob)
    functions: FunctionJob[]


    executionType: JobExecutionType;
}
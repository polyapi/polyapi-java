import { IsArray, IsIn, IsNotEmpty, IsNumber, IsObject, IsString, ValidateNested } from "class-validator";
import { JobExecutionType } from "../../job";
import { Type } from "class-transformer";
import { ApiModelProperty } from "@nestjs/swagger/dist/decorators/api-model-property.decorator";


class JobType {
    @ApiModelProperty({
      name: 'type',
    })
    @IsString()
    @IsIn([JobExecutionType.INTERVAL, JobExecutionType.PERIODICALLY, JobExecutionType.ON_TIME])
    type: JobExecutionType;
}

class OnTime extends JobType {
    @IsString()
    @ApiModelProperty({
      enum: [JobExecutionType.ON_TIME],
    })
    type: JobExecutionType.ON_TIME;

    @IsString()
    @ApiModelProperty()
    @Type(() => Date)
    value: Date;
}

class Periodically extends JobType {
    @IsString()
    @ApiModelProperty({
      enum: [JobExecutionType.PERIODICALLY],
    })
    type: JobExecutionType.PERIODICALLY;

    @IsString()
    @ApiModelProperty()
    value: string;
}

class Interval extends JobType {
    @IsString()
    @ApiModelProperty({
      enum: [JobExecutionType.INTERVAL],
    })
    type: JobExecutionType.INTERVAL;

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
    @Type(() => JobType, {
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
    @Type()
    functions: any[]


    // executionType: 
}
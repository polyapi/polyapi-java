import { IsDate, IsOptional, IsString } from 'class-validator';
import { ApiModelProperty } from '@nestjs/swagger/dist/decorators/api-model-property.decorator';
import { Transform } from 'class-transformer';

export class LogsQuery {
  @IsOptional()
  @IsString()
  @ApiModelProperty({ required: false })
  level?: string;

  @IsOptional()
  @IsString()
  @ApiModelProperty({ required: false })
  context?: string;

  @IsOptional()
  @IsDate()
  @ApiModelProperty({ required: false, example: '2020-01-01T00:00:00.000Z' })
  @Transform(({ value }) => value && new Date(value))
  dateFrom?: Date;

  @IsOptional()
  @IsDate()
  @ApiModelProperty({ required: false, example: '2020-01-01T00:00:00.000Z' })
  @Transform(({ value }) => value && new Date(value))
  dateTo?: Date;
}

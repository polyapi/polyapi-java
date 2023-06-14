import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiImplicitParam } from '@nestjs/swagger/dist/decorators/api-implicit-param.decorator';
import { ApiModelProperty } from '@nestjs/swagger/dist/decorators/api-model-property.decorator';

export class GetTenantQuery {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @ApiModelProperty({ required: false })
  full?: boolean;
}

import { IsBoolean, IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiModelProperty } from '@nestjs/swagger/dist/decorators/api-model-property.decorator';

export class GetTenantQuery {
  @IsOptional()
  @IsBoolean()
  @Transform(({ value }) => value === 'true')
  @ApiModelProperty({ required: false })
  full?: boolean;
}

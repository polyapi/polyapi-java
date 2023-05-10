import { IsOptional } from 'class-validator';
import { Transform } from 'class-transformer';

export class GetTenantQuery {
  @IsOptional()
  @Transform(({ value }) => value === 'true')
  full?: boolean;
}

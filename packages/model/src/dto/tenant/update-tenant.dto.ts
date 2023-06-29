import { IsBoolean, IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsBoolean()
  publicVisibilityAllowed?: boolean;
}

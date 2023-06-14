import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;
  @IsOptional()
  @IsBoolean()
  publicVisibilityAllowed?: boolean;
}

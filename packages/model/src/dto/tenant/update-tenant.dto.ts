import { IsBoolean, IsEmail, IsNotEmpty, IsOptional } from 'class-validator';
import { IsValidPublicNamespace } from './validator/public-namespace-validator';

export class UpdateTenantDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsBoolean()
  publicVisibilityAllowed?: boolean;

  @IsOptional()
  @IsValidPublicNamespace()
  publicNamespace?: string | null;

  @IsOptional()
  tierId?: string | null;
}

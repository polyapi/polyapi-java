import { IsBoolean, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { IsValidPublicNamespace } from './validator/public-namespace-validator';

export class CreateTenantDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsBoolean()
  publicVisibilityAllowed?: boolean;

  @IsOptional()
  @IsValidPublicNamespace()
  publicNamespace?: string;

  @IsOptional()
  @IsNotEmpty()
  tierId?: string;
}

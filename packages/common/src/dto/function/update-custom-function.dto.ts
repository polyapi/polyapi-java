import { IsEnum, IsOptional, IsString } from 'class-validator';
import { Visibility } from '../../specs';

export class UpdateCustomFunctionDto {
  @IsOptional()
  @IsString()
  name?: string
  @IsOptional()
  @IsString()
  context?: string;
  @IsOptional()
  @IsString()
  description?: string;
  @IsOptional()
  @IsString()
  @IsEnum(Visibility)
  visibility?: Visibility;
}

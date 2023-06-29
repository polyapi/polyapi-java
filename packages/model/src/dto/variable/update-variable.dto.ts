import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { ValueType } from './variable.dto';
import { Visibility } from '../../specs';

export class UpdateVariableDto {
  @IsString()
  @IsOptional()
  context?: string;

  @IsString()
  @IsOptional()
  name?: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsOptional()
  value?: ValueType;

  @IsBoolean()
  @IsOptional()
  secret?: boolean;

  @IsOptional()
  @IsString()
  @IsEnum(Visibility)
  visibility?: Visibility;
}

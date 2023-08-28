import { IsBoolean, IsEnum, IsOptional, IsString, Validate } from 'class-validator';
import { ValueType } from './variable.dto';
import { Visibility } from '../../specs';
import { ContextIdentifier, NameIdentifier } from '../validators';

export class UpdateVariableDto {
  @IsString()
  @IsOptional()
  @Validate(ContextIdentifier)
  context?: string;

  @IsString()
  @IsOptional()
  @Validate(NameIdentifier)
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

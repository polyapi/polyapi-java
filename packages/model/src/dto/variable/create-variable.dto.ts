import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString, Validate } from 'class-validator';
import { ValueType } from './variable.dto';
import { Visibility } from '../../specs';
import { ContextIdentifier, NameIdentifier } from '../validators';

export class CreateVariableDto {
  @IsString()
  @IsNotEmpty()
  @Validate(ContextIdentifier)
  context: string;

  @IsString()
  @IsNotEmpty()
  @Validate(NameIdentifier)
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNotEmpty()
  value: ValueType;

  @IsBoolean()
  @IsOptional()
  secret?: boolean;

  @IsOptional()
  @IsString()
  @IsEnum(Visibility)
  visibility?: Visibility;
}

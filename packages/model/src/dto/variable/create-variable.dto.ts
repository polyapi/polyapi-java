import { IsBoolean, IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { ValueType } from './variable.dto';
import { Visibility } from '../../specs';

export class CreateVariableDto {
  @IsString()
  @IsNotEmpty()
  context: string;

  @IsString()
  @IsNotEmpty()
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

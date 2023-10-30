import { IsBoolean, IsEnum, IsNumber, IsOptional, IsString, Validate } from 'class-validator';
import { Visibility } from '../../specs';
import { ContextIdentifier, NameIdentifier } from '../validators';
import { ArgumentsMetadata } from '../../function';

export class UpdateCustomFunctionDto {
  @IsOptional()
  @IsString()
  @Validate(NameIdentifier)
  name?: string;

  @IsOptional()
  @IsString()
  @Validate(ContextIdentifier)
  context?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  arguments?: ArgumentsMetadata;

  @IsOptional()
  @IsBoolean()
  logsEnabled?: boolean;
}

export class UpdateClientCustomFunctionDto extends UpdateCustomFunctionDto {
}

export class UpdateServerCustomFunctionDto extends UpdateCustomFunctionDto {
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  @IsBoolean()
  sleep?: boolean;

  @IsOptional()
  @IsNumber()
  sleepAfter?: number;
}

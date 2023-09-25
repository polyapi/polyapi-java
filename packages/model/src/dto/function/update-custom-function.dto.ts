import { IsBoolean, IsEnum, IsOptional, IsString, Validate } from 'class-validator';
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
  @IsBoolean()
  enabled?: boolean;

  @IsOptional()
  arguments?: ArgumentsMetadata;
}

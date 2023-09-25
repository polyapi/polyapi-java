import { IsString, Validate, IsEnum, IsOptional, ValidateNested, IsObject } from 'class-validator';
import { Type } from 'class-transformer';
import { ArgumentsMetadata } from '../../function';
import { ContextIdentifier, NameIdentifier } from '../validators';
import { Visibility } from '../../specs';

import {
  UpdateSourceFunctionDto
} from './types/update-source';

export * from './types/update-source';

export class UpdateApiFunctionDto {
  @IsOptional()
  @IsString()
  @Validate(NameIdentifier)
  name?: string;

  @IsOptional()
  @IsString()
  @Validate(ContextIdentifier)
  context?: string;

  description?: string;
  arguments?: ArgumentsMetadata;
  response?: any;
  payload?: string;
  @IsOptional()
  @IsString()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsObject()
  @ValidateNested()
  @Type(() => UpdateSourceFunctionDto)
  source?: UpdateSourceFunctionDto;
}

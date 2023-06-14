import { IsString, Validate, IsEnum, IsOptional } from 'class-validator';
import { ArgumentsMetadata } from '../../function';
import { ContextIdentifier, NameIdentifier } from '../validators';
import { Visibility } from '../../specs';

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
}

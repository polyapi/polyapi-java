import { IsEnum, IsOptional, IsString, Validate } from 'class-validator';
import { Visibility } from '../../specs';
import { ContextIdentifier, NameIdentifier } from '../validators';

export class UpdateWebhookHandleDto {
  @IsOptional()
  @IsString()
  @Validate(NameIdentifier)
  name?: string;
  @IsOptional()
  @IsString()
  @Validate(ContextIdentifier)
  context?: string;
  @IsOptional()
  description?: string;
  @IsOptional()
  @IsString()
  @IsEnum(Visibility)
  visibility?: Visibility;
}

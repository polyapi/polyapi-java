import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { Visibility } from '../../specs';

export class UpdateWebhookHandleDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;
  @IsOptional()
  context?: string;
  @IsOptional()
  description?: string;
  @IsOptional()
  @IsString()
  @IsEnum(Visibility)
  visibility?: Visibility;
}

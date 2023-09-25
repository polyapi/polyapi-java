import { IsArray, IsBoolean, IsEnum, IsIn, IsNumber, IsObject, IsOptional, IsString, Max, Min, Validate } from 'class-validator';
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

  @IsObject()
  @IsOptional()
  eventPayload?: any;

  @IsOptional()
  @IsObject()
  responsePayload?: any;

  @IsOptional()
  @IsObject()
  responseHeaders?: any;

  @IsOptional()
  @IsNumber()
  @Min(200)
  @Max(299)
  responseStatus?: number;

  @IsOptional()
  @IsString()
  subpath?: string;

  @IsOptional()
  @IsIn(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
  method?: string;

  @IsOptional()
  @IsString({ each: true })
  @IsArray()
  securityFunctionIds?: string[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

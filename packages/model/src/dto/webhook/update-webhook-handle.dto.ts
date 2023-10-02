import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
  Validate,
  ValidateNested,
} from 'class-validator';
import { Visibility } from '../../specs';
import { ContextIdentifier, NameIdentifier } from '../validators';
import { WebhookSecurityFunction } from './webhook-security-function';
import { Type } from 'class-transformer';

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

  @IsOptional()
  eventPayload?: any;

  @IsOptional()
  @IsIn(['string', 'number', 'boolean', 'object'])
  eventPayloadType?: string;

  @IsOptional()
  eventPayloadTypeSchema?: Record<string, any>;

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
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => WebhookSecurityFunction)
  securityFunctions?: WebhookSecurityFunction[];

  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}

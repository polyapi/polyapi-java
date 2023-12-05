import { IsArray, IsEnum, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Validate } from 'class-validator';
import { ContextIdentifier, NameIdentifier } from '../validators';
import { Visibility } from '../../specs';
import { HTTP_METHODS } from '../utils';
import { WebhookSecurityFunction } from './webhook-security-function';

export class CreateWebhookHandleDto {
  @IsNotEmpty()
  @Validate(NameIdentifier)
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  @Validate(ContextIdentifier)
  context?: string;

  @IsOptional()
  eventPayload?: any;

  @IsOptional()
  eventPayloadTypeSchema?: Record<string, any>;

  description: string;

  @IsOptional()
  @IsString()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  responsePayload?: any;

  @IsOptional()
  @IsObject()
  responseHeaders?: any;

  @IsOptional()
  @IsNumber()
  responseStatus?: number;

  @IsOptional()
  @IsString()
  subpath?: string;

  @IsOptional()
  @IsIn(HTTP_METHODS)
  method?: string;

  @IsOptional()
  @IsArray()
  securityFunctions?: WebhookSecurityFunction[];

  @IsOptional()
  @IsString()
  templateBody: string;
}

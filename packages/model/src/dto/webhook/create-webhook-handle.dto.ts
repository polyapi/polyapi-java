import { IsArray, IsEnum, IsIn, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, Validate } from 'class-validator';
import { ContextIdentifier, NameIdentifier } from '../validators';
import { Visibility } from '../../specs';
import { HTTP_METHODS } from '../utils';

export class CreateWebhookHandleDto {
  @IsNotEmpty()
  @Validate(NameIdentifier)
  @IsString()
  name: string;

  @IsOptional()
  @IsString()
  @Validate(ContextIdentifier)
  context?: string;

  @IsObject()
  eventPayload: any;

  description: string;

  @IsOptional()
  @IsString()
  @IsEnum(Visibility)
  visibility?: Visibility;

  @IsOptional()
  @IsObject()
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
  @IsString({ each: true })
  @IsArray()
  securityFunctionIds?: string[];
}

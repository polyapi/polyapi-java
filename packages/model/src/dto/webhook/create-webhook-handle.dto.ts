import { IsNotEmpty, IsObject, IsOptional, IsString, Validate } from 'class-validator';
import { ContextIdentifier, NameIdentifier } from '../validators';

export class CreateWebhookHandleDto {
  @IsNotEmpty()
  @Validate(NameIdentifier)
  @IsString()
  name: string;
  @IsOptional()
  @IsString()
  @Validate(ContextIdentifier)
  context: string;
  @IsObject()
  eventPayload: any;
  description: string;
}

import { IsOptional, IsString } from 'class-validator';

export class WebhookSecurityFunction {
  @IsString()
  id: string;

  @IsOptional()
  @IsString()
  message?: string;
}

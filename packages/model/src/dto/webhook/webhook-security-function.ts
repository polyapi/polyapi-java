import { IsString, IsOptional } from 'class-validator';

export class WebhookSecurityFunction {
  @IsString()
  id: string;

  @IsString()
  @IsOptional()
  message?: string;
}

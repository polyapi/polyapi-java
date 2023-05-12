import { IsNotEmpty, IsOptional } from 'class-validator';

export class UpdateWebhookHandleDto {
  @IsOptional()
  @IsNotEmpty()
  name?: string;
  @IsOptional()
  context?: string;
  @IsOptional()
  description?: string;
}

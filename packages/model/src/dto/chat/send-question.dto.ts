import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendQuestionDto {
  @IsString()
  @IsOptional()
  message: string;

  @IsString()
  @IsOptional()
  message_uuid: string;
}
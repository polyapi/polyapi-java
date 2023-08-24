import { IsOptional, IsString } from 'class-validator';

export class SendQuestionDto {
  @IsString()
  @IsOptional()
  message: string;

  @IsString()
  @IsOptional()
  message_uuid: string;

  @IsOptional()
  @IsString()
  workspaceFolder: string = '';
}


import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SendQuestionDto {
  @IsString()
  @IsNotEmpty()
  message: string;
  @IsOptional()
  @IsString()
  workspaceFolder: string = '';
}

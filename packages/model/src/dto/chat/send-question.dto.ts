import { IsNotEmpty, IsOptional } from 'class-validator';

export class SendQuestionDto {
  @IsNotEmpty()
  message: string;
  @IsOptional()
  workspaceFolder: string = '';
}

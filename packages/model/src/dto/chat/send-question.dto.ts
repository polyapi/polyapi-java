import { IsNotEmpty } from 'class-validator';

export class SendQuestionDto {
  @IsNotEmpty()
  message: string;
}

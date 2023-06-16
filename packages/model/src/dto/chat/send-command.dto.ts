import { IsNotEmpty } from 'class-validator';

export class SendCommandDto {
  @IsNotEmpty()
  command: string;
}

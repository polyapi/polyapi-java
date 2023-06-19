import { IsNotEmpty } from 'class-validator';

export class SendConfigureDto {
  @IsNotEmpty()
  name: string;
  @IsNotEmpty()
  value: string;
}

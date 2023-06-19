import { IsNotEmpty } from 'class-validator';

export class UpdateEnvironmentDto {
  @IsNotEmpty()
  name: string;
}

import { IsNotEmpty } from 'class-validator';

export class UpdateTeamDto {
  @IsNotEmpty()
  name: string;
}

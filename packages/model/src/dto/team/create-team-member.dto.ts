import { IsNotEmpty } from 'class-validator';

export class CreateTeamMemberDto {
  @IsNotEmpty()
  userId: string;
}

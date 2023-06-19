import { UserDto } from '../user';

export class TeamMemberDto {
  id: string;
  teamId: string;
  user: UserDto;
}

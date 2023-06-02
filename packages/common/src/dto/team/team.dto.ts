import { TeamMemberDto } from './team-member.dto';

export class TeamDto {
  id: string;
  name: string;
}

export class TeamFullDto extends TeamDto {
  members: TeamMemberDto[];
}

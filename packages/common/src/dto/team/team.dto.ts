import { UserFullDto } from '../user';

export class TeamDto {
  id: string;
  name: string;
}

export class TeamFullDto extends TeamDto {
  users: UserFullDto[];
}

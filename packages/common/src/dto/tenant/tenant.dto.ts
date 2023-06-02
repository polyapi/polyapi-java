import { EnvironmentFullDto } from '../environment';
import { TeamFullDto } from '../team';
import { UserDto } from '../user';

export class TenantDto {
  id: string;
  name: string;
}

export class TenantFullDto extends TenantDto {
  users: UserDto[];
  environments: EnvironmentFullDto[];
  teams: TeamFullDto[];
}

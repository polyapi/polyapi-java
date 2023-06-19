import { EnvironmentFullDto } from '../environment';
import { TeamFullDto } from '../team';
import { ApplicationDto } from '../application';
import { UserDto } from '../user';

export class TenantDto {
  id: string;
  name: string;
  publicVisibilityAllowed: boolean;
}

export class TenantFullDto extends TenantDto {
  users: UserDto[];
  environments: EnvironmentFullDto[];
  applications: ApplicationDto[];
  teams: TeamFullDto[];
}

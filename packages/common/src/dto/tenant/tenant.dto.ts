import { EnvironmentDto } from '../environment';
import { TeamFullDto } from '../team';

export class TenantDto {
  id: string;
  name: string;
}

export class TenantFullDto extends TenantDto {
  environments: EnvironmentDto[];
  teams: TeamFullDto[];
}

import { Permissions } from '../../permissions';

export class UserKeyDto {
  id: string;
  environmentId: string;
  key: string;
  permissions: Permissions;
}

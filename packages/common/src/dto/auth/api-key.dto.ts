import { Permissions } from '../../permissions';

export interface ApiKeyDto {
  id: string;
  name: string;
  key: string;
  environmentId: string;
  userId: string | null;
  applicationId: string | null;
  permissions: Permissions;
}

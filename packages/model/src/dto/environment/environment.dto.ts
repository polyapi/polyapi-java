import { ApiKeyDto } from '../..';

export class EnvironmentDto {
  id: string;
  name: string;
  subdomain: string;
  logsDefault?: boolean;
}

export class EnvironmentFullDto extends EnvironmentDto {
  apiKeys: ApiKeyDto[];
}

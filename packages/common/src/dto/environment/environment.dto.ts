import { ApiKeyDto } from '../..';

export class EnvironmentDto {
  id: string;
  name: string;
  subdomain: string;
}

export class EnvironmentFullDto extends EnvironmentDto {
  apiKeys: ApiKeyDto[];
}

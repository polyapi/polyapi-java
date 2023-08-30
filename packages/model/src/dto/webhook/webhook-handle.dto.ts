import { Visibility } from '../../specs';

export interface WebhookHandleDto {
  id: string;
  name: string;
  context: string;
  description: string;
  url: string;
  visibility: Visibility;
}

export interface WebhookHandlePublicDto extends WebhookHandleDto {
  tenant: string;
  hidden: boolean;
}

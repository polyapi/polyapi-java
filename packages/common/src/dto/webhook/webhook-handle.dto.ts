import { Visibility } from '../../specs';

export interface WebhookHandleDto {
  id: string;
  name: string;
  context: string;
  description: string;
  url: string;
  visibility: Visibility;
}

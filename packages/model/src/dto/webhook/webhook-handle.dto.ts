import { Visibility } from '../../specs';

export interface WebhookHandleDto {
  id: string;
  name: string;
  context: string;
  description: string;
  url: string;
  visibility: Visibility;
  responsePayload?: any;
  responseHeaders?: any;
  responseStatus: number | null;
  subpath: string | null;
  method: string | null;
  securityFunctionIds: string[];
  enabled?: boolean;
}

export interface WebhookHandlePublicDto extends WebhookHandleDto {
  tenant: string;
  hidden: boolean;
}

import { Visibility } from '../../specs';
import { WebhookSecurityFunction } from './webhook-security-function';

export interface WebhookHandleDto {
  id: string;
  name: string;
  context: string;
  description: string;
  url: string;
  visibility: Visibility;
  eventPayloadType: string;
  eventPayloadTypeSchema?: Record<string, any>;
  responsePayload?: any;
  responseHeaders?: any;
  responseStatus: number | null;
  subpath: string | null;
  method: string | null;
  securityFunctions: WebhookSecurityFunction[];
  enabled?: boolean;
}

export interface WebhookHandlePublicDto extends WebhookHandleDto {
  tenant: string;
  hidden: boolean;
}

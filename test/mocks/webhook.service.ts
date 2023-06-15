import { getFnMock, TypedMock } from '../utils/test-utils';
import { WebhookService } from 'webhook/webhook.service';

export default {
  getWebhookHandles: getFnMock<WebhookService['getWebhookHandles']>(),
  toWebhookHandleSpecification: getFnMock<WebhookService['toWebhookHandleSpecification']>(),
} as TypedMock<WebhookService>;

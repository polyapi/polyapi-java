import { PrismaService } from 'prisma/prisma.service';
import { FunctionService } from 'function/function.service';
import { AuthService } from 'auth/auth.service';
import { WebhookService } from 'webhook/webhook.service';

export interface MigrationContext {
  prisma: PrismaService;
  functionService: FunctionService;
  authService: AuthService;
  webhookService: WebhookService;
}

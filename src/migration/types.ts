import { PrismaService } from 'prisma-module/prisma.service';
import { FunctionService } from 'function/function.service';
import { AuthService } from 'auth/auth.service';
import { WebhookService } from 'webhook/webhook.service';
import { Logger } from '@nestjs/common';

export interface MigrationContext {
  prisma: PrismaService;
  functionService: FunctionService;
  authService: AuthService;
  webhookService: WebhookService;
  loggerService: Logger
}

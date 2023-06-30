import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from 'prisma/prisma.module';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { CommonModule } from 'common/common.module';
import { EventModule } from 'event/event.module';
import { UserModule } from 'user/user.module';
import { SpecsModule } from 'specs/specs.module';
import { AiModule } from 'ai/ai.module';
import { AuthModule } from 'auth/auth.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';

@Module({
  providers: [WebhookService],
  controllers: [WebhookController],
  imports: [PrismaModule, HttpModule, EventModule, CommonModule, UserModule, AiModule, AuthModule, forwardRef(() => SpecsModule), ConfigVariableModule],
  exports: [WebhookService],
})
export class WebhookModule {
}

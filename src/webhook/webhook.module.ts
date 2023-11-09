import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from 'prisma-module/prisma.module';
import { WebhookService } from './webhook.service';
import { WebhookController } from './webhook.controller';
import { CommonModule } from 'common/common.module';
import { EventModule } from 'event/event.module';
import { UserModule } from 'user/user.module';
import { SpecsModule } from 'specs/specs.module';
import { AiModule } from 'ai/ai.module';
import { AuthModule } from 'auth/auth.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';
import { TriggerModule } from 'trigger/trigger.module';
import { LimitModule } from 'limit/limit.module';
import { FunctionModule } from 'function/function.module';
import { EnvironmentModule } from 'environment/environment.module';
import { StatisticsModule } from 'statistics/statistics.module';

@Module({
  providers: [WebhookService],
  controllers: [WebhookController],
  imports: [
    PrismaModule,
    HttpModule,
    forwardRef(() => EventModule),
    CommonModule,
    UserModule,
    AiModule,
    AuthModule,
    forwardRef(() => SpecsModule),
    ConfigVariableModule,
    forwardRef(() => TriggerModule),
    LimitModule,
    forwardRef(() => FunctionModule),
    EnvironmentModule,
    StatisticsModule,
  ],
  exports: [WebhookService],
})
export class WebhookModule {
}

import { forwardRef, Module } from '@nestjs/common';
import { TriggerController } from './trigger.controller';
import { TriggerService } from './trigger.service';
import { WebhookModule } from 'webhook/webhook.module';
import { FunctionModule } from 'function/function.module';
import { AuthModule } from 'auth/auth.module';
import { EventModule } from 'event/event.module';
import { EnvironmentModule } from 'environment/environment.module';

@Module({
  controllers: [TriggerController],
  providers: [TriggerService],
  imports: [
    forwardRef(() => WebhookModule),
    forwardRef(() => FunctionModule),
    forwardRef(() => EventModule),
    forwardRef(() => EnvironmentModule),
    AuthModule,
  ],
  exports: [TriggerService],
})
export class TriggerModule {}

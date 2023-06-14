import { forwardRef, Module } from '@nestjs/common';
import { SpecsController } from './specs.controller';
import { SpecsService } from './specs.service';
import { FunctionModule } from 'function/function.module';
import { AuthProviderModule } from 'auth-provider/auth-provider.module';
import { WebhookModule } from 'webhook/webhook.module';
import { AuthModule } from 'auth/auth.module';

@Module({
  imports: [
    forwardRef(() => FunctionModule),
    forwardRef(() => WebhookModule),
    forwardRef(() => AuthProviderModule),
    AuthModule,
  ],
  controllers: [SpecsController],
  exports: [SpecsService],
  providers: [SpecsService],
})
export class SpecsModule {}

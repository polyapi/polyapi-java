import { forwardRef, Module } from '@nestjs/common';
import { SpecsController } from './specs.controller';
import { SpecsService } from './specs.service';
import { FunctionModule } from 'function/function.module';
import { AuthProviderModule } from 'auth-provider/auth-provider.module';
import { WebhookModule } from 'webhook/webhook.module';
import { AuthModule } from 'auth/auth.module';
import { VariableModule } from 'variable/variable.module';
import { CommonModule } from 'common/common.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';

@Module({
  imports: [
    CommonModule,
    forwardRef(() => FunctionModule),
    forwardRef(() => WebhookModule),
    forwardRef(() => AuthProviderModule),
    forwardRef(() => VariableModule),
    AuthModule,
    ConfigVariableModule,
  ],
  controllers: [SpecsController],
  exports: [SpecsService],
  providers: [SpecsService],
})
export class SpecsModule {}

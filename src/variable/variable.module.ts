import { forwardRef, Module } from '@nestjs/common';
import { VariableController } from './variable.controller';
import { SecretModule } from 'secret/secret.module';
import { VariableService } from './variable.service';
import { AuthModule } from 'auth/auth.module';
import { PrismaModule } from 'prisma-module/prisma.module';
import { CommonModule } from 'common/common.module';
import { SpecsModule } from 'specs/specs.module';
import { FunctionModule } from 'function/function.module';
import { EventModule } from 'event/event.module';
import { AiModule } from 'ai/ai.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';
import { StatisticsModule } from 'statistics/statistics.module';
import { LimitModule } from 'limit/limit.module';

@Module({
  imports: [
    SecretModule,
    AuthModule,
    PrismaModule,
    CommonModule,
    forwardRef(() => SpecsModule),
    forwardRef(() => FunctionModule),
    forwardRef(() => EventModule),
    AiModule,
    ConfigVariableModule,
    LimitModule,
    StatisticsModule,
  ],
  controllers: [VariableController],
  providers: [VariableService],
  exports: [VariableService],
})
export class VariableModule {}

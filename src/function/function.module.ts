import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { FunctionService } from 'function/function.service';
import { PrismaModule } from 'prisma/prisma.module';
import { FunctionController } from 'function/function.controller';
import { EventModule } from 'event/event.module';
import { CommonModule } from 'common/common.module';
import { AiModule } from 'ai/ai.module';
import { SpecsModule } from 'specs/specs.module';
import { AuthModule } from 'auth/auth.module';
import { VariableModule } from 'variable/variable.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';
import { LimitModule } from 'limit/limit.module';
import { StatisticsModule } from 'statistics/statistics.module';
import { EnvironmentModule } from 'environment/environment.module';

@Module({
  imports: [
    PrismaModule,
    HttpModule,
    AuthModule,
    EventModule,
    CommonModule,
    AiModule,
    forwardRef(() => SpecsModule),
    ConfigVariableModule,
    VariableModule,
    LimitModule,
    StatisticsModule,
    EnvironmentModule,
  ],
  providers: [FunctionService],
  exports: [FunctionService],
  controllers: [FunctionController],
})
export class FunctionModule {
}

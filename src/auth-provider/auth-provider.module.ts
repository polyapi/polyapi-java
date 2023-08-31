import { forwardRef, Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AuthProviderController } from './auth-provider.controller';
import { AuthProviderService } from './auth-provider.service';
import { PrismaModule } from 'prisma/prisma.module';
import { EventModule } from 'event/event.module';
import { SpecsModule } from 'specs/specs.module';
import { AuthModule } from 'auth/auth.module';
import { CommonModule } from 'common/common.module';
import { VariableModule } from 'variable/variable.module';
import { LimitModule } from 'limit/limit.module';
import { StatisticsModule } from 'statistics/statistics.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';

@Module({
  imports: [
    PrismaModule,
    forwardRef(() => EventModule),
    HttpModule,
    AuthModule,
    forwardRef(() => SpecsModule),
    CommonModule,
    VariableModule,
    LimitModule,
    StatisticsModule,
    ConfigVariableModule,
  ],
  controllers: [AuthProviderController],
  providers: [AuthProviderService],
  exports: [AuthProviderService],
})
export class AuthProviderModule {}

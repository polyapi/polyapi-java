import { forwardRef, Module } from '@nestjs/common';
import { TenantService } from './tenant.service';
import { TenantController } from './tenant.controller';
import { PrismaModule } from 'prisma/prisma.module';
import { EnvironmentModule } from 'environment/environment.module';
import { UserModule } from 'user/user.module';
import { TeamModule } from 'team/team.module';
import { AuthModule } from 'auth/auth.module';
import { ApplicationModule } from 'application/application.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';
import { LimitModule } from 'limit/limit.module';

@Module({
  imports: [
    PrismaModule,
    EnvironmentModule,
    ApplicationModule,
    TeamModule,
    UserModule,
    forwardRef(() => AuthModule),
    ConfigVariableModule,
    LimitModule,
  ],
  providers: [TenantService],
  controllers: [TenantController],
  exports: [TenantService],
})
export class TenantModule {}

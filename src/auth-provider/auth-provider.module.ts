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

@Module({
  imports: [
    PrismaModule,
    EventModule,
    HttpModule,
    AuthModule,
    forwardRef(() => SpecsModule),
    CommonModule,
    VariableModule,
  ],
  controllers: [AuthProviderController],
  providers: [AuthProviderService],
  exports: [AuthProviderService],
})
export class AuthProviderModule {}

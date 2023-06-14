import { PrismaModule } from 'prisma/prisma.module';
import { forwardRef, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PolyAuthStrategy } from 'auth/poly-auth-strategy.service';
import { UserModule } from 'user/user.module';
import { AuthService } from './auth.service';
import { EnvironmentModule } from 'environment/environment.module';
import { TenantModule } from 'tenant/tenant.module';

@Module({
  imports: [PrismaModule, PassportModule, forwardRef(() => TenantModule), EnvironmentModule, UserModule],
  providers: [PolyAuthStrategy, AuthService],
  exports: [AuthService],
})
export class AuthModule {
}

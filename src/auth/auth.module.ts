import { forwardRef, Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { PolyKeyStrategy } from 'auth/poly-key.strategy';
import { UserModule } from 'user/user.module';
import { AuthService } from './auth.service';
import { EnvironmentModule } from 'environment/environment.module';
import { TenantModule } from 'tenant/tenant.module';

@Module({
  imports: [PassportModule, forwardRef(() => TenantModule), EnvironmentModule, UserModule],
  providers: [PolyKeyStrategy, AuthService],
  exports: [AuthService],
})
export class AuthModule {
}

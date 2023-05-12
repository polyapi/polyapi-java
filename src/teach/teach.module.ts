import { Module } from '@nestjs/common';
import { FunctionModule } from 'function/function.module';
import { TeachController } from 'teach/teach.controller';
import { AuthModule } from 'auth/auth.module';
import { UserModule } from 'user/user.module';

@Module({
  imports: [FunctionModule, AuthModule, UserModule],
  controllers: [TeachController]
})
export class TeachModule {
}

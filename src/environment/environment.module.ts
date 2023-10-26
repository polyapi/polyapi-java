import { Module } from '@nestjs/common';
import { EnvironmentService } from './environment.service';
import { PrismaModule } from 'prisma-module/prisma.module';
import { SecretModule } from 'secret/secret.module';

@Module({
  imports: [PrismaModule, SecretModule],
  providers: [EnvironmentService],
  exports: [EnvironmentService],
})
export class EnvironmentModule {}

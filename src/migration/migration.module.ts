import { Module } from '@nestjs/common';
import { MigrationService } from './migration.service';
import { PrismaModule } from 'prisma/prisma.module';
import { FunctionModule } from 'function/function.module';
import { AuthModule } from 'auth/auth.module';

@Module({
  imports: [PrismaModule, FunctionModule, AuthModule],
  providers: [MigrationService],
})
export class MigrationModule {}

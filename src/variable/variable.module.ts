import { Module } from '@nestjs/common';
import { VariableController } from './variable.controller';
import { SecretModule } from 'secret/secret.module';
import { VariableService } from './variable.service';
import { AuthModule } from 'auth/auth.module';
import { PrismaModule } from 'prisma/prisma.module';
import { CommonModule } from 'common/common.module';

@Module({
  imports: [SecretModule, AuthModule, PrismaModule, CommonModule],
  controllers: [VariableController],
  providers: [VariableService],
})
export class VariableModule {}

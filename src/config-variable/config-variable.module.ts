import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { ConfigVariableService } from './config-variable.service';
import { ConfigVariableController } from './config-variable.controller';
import { CommonModule } from 'common/common.module';

@Module({
  imports: [PrismaModule, CommonModule],
  providers: [ConfigVariableService],
  exports: [ConfigVariableService],
  controllers: [ConfigVariableController],
})
export class ConfigVariableModule {}

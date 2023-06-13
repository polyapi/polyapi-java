import { Module } from '@nestjs/common';
import { PrismaModule } from 'prisma/prisma.module';
import { ConfigVariableService } from './config-varirable.service';
import { ConfigVariableController } from './config-variable.controller';

@Module({
  imports: [PrismaModule],
  providers: [ConfigVariableService],
  exports: [ConfigVariableService],
  controllers: [ConfigVariableController],
})
export class ConfigVariableModule {}

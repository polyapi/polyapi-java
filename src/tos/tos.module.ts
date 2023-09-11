import { Module } from '@nestjs/common';
import { TosController } from './tos.controller';
import { TosService } from './tos.service';
import { PrismaModule } from 'prisma/prisma.module';
import { CommonModule } from 'common/common.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';

@Module({
  controllers: [TosController],
  providers: [TosService],
  exports: [TosService],
  imports: [PrismaModule, CommonModule, ConfigVariableModule],
})
export class TosModule {}

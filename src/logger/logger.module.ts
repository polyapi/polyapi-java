import { Module } from '@nestjs/common';
import { LoggerService } from './logger.service';
import { PrismaModule } from 'prisma/prisma.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';

@Module({
  imports: [
    PrismaModule,
    ConfigVariableModule,
  ],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}

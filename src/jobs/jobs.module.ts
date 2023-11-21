import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { FunctionModule } from 'function/function.module';
import { PrismaModule } from 'prisma-module/prisma.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { CommonModule } from 'common/common.module';
import { QUEUE_NAME } from './constants';

@Module({
  controllers: [JobsController],
  providers: [JobsService],
  imports: [
    FunctionModule, PrismaModule, ConfigVariableModule, FunctionModule, HttpModule, BullModule.registerQueue({
      name: QUEUE_NAME,
    }),
    CommonModule,
  ],
})
export class JobsModule {}

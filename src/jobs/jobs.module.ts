import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { FunctionModule } from 'function/function.module';
import { PrismaModule } from 'prisma-module/prisma.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';
import { HttpModule } from '@nestjs/axios';
import { BullModule } from '@nestjs/bull';
import { CommonModule } from 'common/common.module';
import { JOB_PREFIX, QUEUE_NAME } from './constants';
import path from 'path';

@Module({
  controllers: [JobsController],
  providers: [JobsService],
  imports: [
    FunctionModule, PrismaModule, ConfigVariableModule, FunctionModule, HttpModule, BullModule.registerQueue({
      name: QUEUE_NAME,
      processors: [
        {
          path: path.join(__dirname, 'processor.js'),
          name: JOB_PREFIX,
          concurrency: 4,
        },
      ],
    }),
    CommonModule,
  ],
})
export class JobsModule {}

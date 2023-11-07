import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { FunctionModule } from 'function/function.module';
import { PrismaModule } from 'prisma/prisma.module';
import { ConfigVariableModule } from 'config-variable/config-variable.module';
import { HttpModule } from '@nestjs/axios';

@Module({
  controllers: [JobsController],
  providers: [JobsService],
  imports: [FunctionModule, PrismaModule, ConfigVariableModule, FunctionModule, HttpModule],
})
export class JobsModule {}

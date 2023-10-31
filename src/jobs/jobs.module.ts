import { Module } from '@nestjs/common';
import { JobsController } from './jobs.controller';
import { JobsService } from './jobs.service';
import { FunctionModule } from 'function/function.module';
import { PrismaModule } from 'prisma/prisma.module';

@Module({
  controllers: [JobsController],
  providers: [JobsService],
  imports: [FunctionModule, PrismaModule],
})
export class JobsModule {}

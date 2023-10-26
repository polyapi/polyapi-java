import { PrismaModule } from 'prisma-module/prisma.module';
import { Module } from '@nestjs/common';
import { ApplicationService } from './application.service';

@Module({
  imports: [PrismaModule],
  providers: [ApplicationService],
  exports: [ApplicationService],
})
export class ApplicationModule {}

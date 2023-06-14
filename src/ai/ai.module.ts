import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { AiService } from './ai.service';
import { PrismaModule } from 'prisma/prisma.module';
import { ConfigModule } from 'config/config.module';

@Module({
  imports: [HttpModule, ConfigModule, PrismaModule],
  providers: [AiService],
  exports: [AiService],
})
export class AiModule {
}

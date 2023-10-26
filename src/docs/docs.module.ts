import { PrismaModule } from 'prisma-module/prisma.module';
import { DocsController } from './docs.controller';
import { DocsService } from './docs.service';
import { AiModule } from 'ai/ai.module';
import { Module } from '@nestjs/common';

@Module({
  imports: [PrismaModule, AiModule],
  providers: [DocsService],
  controllers: [DocsController],
})
export class DocsModule {}

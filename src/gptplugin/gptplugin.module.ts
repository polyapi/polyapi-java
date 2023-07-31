import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from 'prisma/prisma.module';
import { GptPluginService } from 'gptplugin/gptplugin.service';
import { GptPluginController } from 'gptplugin/gptplugin.controller';
import { FunctionModule } from 'function/function.module';
import { AiModule } from 'ai/ai.module';

@Module({
  imports: [HttpModule, PrismaModule, FunctionModule, AiModule],
  providers: [GptPluginService],
  controllers: [GptPluginController],
})
export class GptPluginModule {}

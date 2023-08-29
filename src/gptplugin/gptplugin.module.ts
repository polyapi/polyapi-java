import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from 'prisma/prisma.module';
import { GptPluginService } from 'gptplugin/gptplugin.service';
import { GptPluginController } from 'gptplugin/gptplugin.controller';
import { FunctionModule } from 'function/function.module';
import { ChatService } from 'chat/chat.service';
import { ChatModule } from 'chat/chat.module';
import { AiModule } from 'ai/ai.module';

@Module({
  imports: [HttpModule, PrismaModule, FunctionModule, AiModule, ChatModule],
  providers: [GptPluginService, ChatService],
  controllers: [GptPluginController],
})
export class GptPluginModule {}

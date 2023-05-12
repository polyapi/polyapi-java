import { Module } from '@nestjs/common';
import { ChatService } from 'chat/chat.service';
import { ChatController } from 'chat/chat.controller';
import { AiModule } from 'ai/ai.module';
import { UserModule } from 'user/user.module';

@Module({
  imports: [AiModule, UserModule],
  providers: [ChatService],
  controllers: [ChatController]
})
export class ChatModule {}

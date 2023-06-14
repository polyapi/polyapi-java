import { Module } from '@nestjs/common';
import { EventGateway } from './event.gateway';
import { EventService } from './event.service';
import { AuthModule } from 'auth/auth.module';

@Module({
  imports: [AuthModule],
  providers: [EventGateway, EventService],
  exports: [EventService],
})
export class EventModule {}

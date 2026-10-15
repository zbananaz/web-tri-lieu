import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { ChatController } from './chat.controller.js';
import { ChatService } from './chat.service.js';
import { RealtimeService } from './realtime.service.js';

@Module({
  imports: [CasesModule],
  controllers: [ChatController],
  providers: [ChatService, RealtimeService],
})
export class ChatModule {}

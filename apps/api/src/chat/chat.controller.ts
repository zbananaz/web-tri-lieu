import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { type AuthUser, type SendMessageInput, sendMessageSchema } from '@wtl/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser } from '../common/decorators.js';
import { rateLimit } from '../common/limits.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ChatService } from './chat.service.js';

const listQuery = z.object({
  before: z.iso.datetime().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

@Controller()
export class ChatController {
  constructor(private readonly chat: ChatService) {}

  @Get('messages/unread')
  unread(@CurrentUser() user: AuthUser) {
    return this.chat.unread(user);
  }

  @Get('cases/:caseId/messages')
  async list(
    @CurrentUser() user: AuthUser,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Query(new ZodPipe(listQuery)) query: z.infer<typeof listQuery>,
    @Req() req: Request,
  ) {
    return { messages: await this.chat.list(user, caseId, query.before, query.limit, req.ip) };
  }

  @Throttle({ default: { limit: rateLimit(60), ttl: 60_000 } })
  @Post('cases/:caseId/messages')
  async send(
    @CurrentUser() user: AuthUser,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body(new ZodPipe(sendMessageSchema)) body: SendMessageInput,
  ) {
    return { message: await this.chat.send(user, caseId, body.body) };
  }

  @HttpCode(200)
  @Post('cases/:caseId/messages/read')
  read(@CurrentUser() user: AuthUser, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return this.chat.markRead(user, caseId);
  }
}

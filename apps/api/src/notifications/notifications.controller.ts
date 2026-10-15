import { Body, Controller, Get, HttpCode, Post } from '@nestjs/common';
import { type AuthUser, type MarkReadInput, markReadSchema } from '@wtl/shared';
import { CurrentUser } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { NotificationsService } from './notifications.service.js';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser) {
    return this.notifications.list(user);
  }

  @HttpCode(204)
  @Post('read')
  async read(@CurrentUser() user: AuthUser, @Body(new ZodPipe(markReadSchema)) body: MarkReadInput): Promise<void> {
    await this.notifications.markRead(user, body);
  }
}

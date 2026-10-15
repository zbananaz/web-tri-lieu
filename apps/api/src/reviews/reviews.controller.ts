import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import {
  type AuthUser,
  type ModerateReviewInput,
  type ReviewInput,
  REVIEW_STATUSES,
  moderateReviewSchema,
  reviewInputSchema,
} from '@wtl/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Public, Roles } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ReviewsService } from './reviews.service.js';

@Controller()
export class ReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Roles('client')
  @Post('appointments/:id/review')
  create(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(reviewInputSchema)) body: ReviewInput,
    @Req() req: Request,
  ) {
    return this.reviews.create(user, id, body, req.ip);
  }

  @Roles('client')
  @Get('reviews/mine')
  async mine(@CurrentUser() user: AuthUser) {
    return { reviews: await this.reviews.mine(user) };
  }

  @Public()
  @Get('experts/:id/reviews')
  async forExpert(@Param('id', ParseUUIDPipe) id: string) {
    return { reviews: await this.reviews.publicForExpert(id) };
  }
}

const adminQuery = z.object({ status: z.enum(REVIEW_STATUSES).optional() });

@Roles('admin')
@Controller('admin/reviews')
export class AdminReviewsController {
  constructor(private readonly reviews: ReviewsService) {}

  @Get()
  async list(@Query(new ZodPipe(adminQuery)) query: z.infer<typeof adminQuery>) {
    return { reviews: await this.reviews.adminList(query.status) };
  }

  @Patch(':id')
  moderate(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(moderateReviewSchema)) body: ModerateReviewInput,
    @Req() req: Request,
  ) {
    return this.reviews.moderate(actor, id, body, req.ip);
  }
}

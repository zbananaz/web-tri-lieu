import { Body, Controller, Get, Param, ParseUUIDPipe, Patch, Post, Query, Req } from '@nestjs/common';
import {
  type AdminUpdateExpertInput,
  type AuthUser,
  type CreateExpertInput,
  type ExpertQuery,
  type UpdateExpertProfileInput,
  adminUpdateExpertSchema,
  createExpertSchema,
  expertQuerySchema,
  updateExpertProfileSchema,
} from '@wtl/shared';
import type { Request } from 'express';
import { CurrentUser, Public, Roles } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { ExpertsService } from './experts.service.js';

@Controller()
export class ExpertsController {
  constructor(private readonly experts: ExpertsService) {}

  @Public()
  @Get('specialties')
  specialties() {
    return this.experts.listSpecialties().then((specialties) => ({ specialties }));
  }

  @Public()
  @Get('experts')
  list(@Query(new ZodPipe(expertQuerySchema)) query: ExpertQuery) {
    return this.experts.listPublic(query).then((experts) => ({ experts }));
  }

  @Roles('expert')
  @Patch('experts/me')
  async updateMe(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(updateExpertProfileSchema)) body: UpdateExpertProfileInput,
    @Req() req: Request,
  ) {
    await this.experts.updateProfile(user.id, body, user.id, req.ip);
    return this.experts.getPublic(user.id);
  }

  @Public()
  @Get('experts/:id')
  get(@Param('id', ParseUUIDPipe) id: string) {
    return this.experts.getPublic(id);
  }
}

@Roles('admin')
@Controller('admin/experts')
export class AdminExpertsController {
  constructor(private readonly experts: ExpertsService) {}

  @Get()
  list() {
    return this.experts.listForAdmin().then((experts) => ({ experts }));
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body(new ZodPipe(createExpertSchema)) body: CreateExpertInput, @Req() req: Request) {
    return this.experts.create(body, actor.id, req.ip);
  }

  @Patch(':id')
  async update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(adminUpdateExpertSchema)) body: AdminUpdateExpertInput,
    @Req() req: Request,
  ) {
    await this.experts.updateProfile(id, body, actor.id, req.ip);
    return { ok: true };
  }
}

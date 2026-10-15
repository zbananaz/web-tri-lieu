import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import {
  type AuthUser,
  type BookAppointmentInput,
  type ConfirmAppointmentInput,
  bookAppointmentSchema,
  cancelAppointmentSchema,
  confirmAppointmentSchema,
  setAvailabilitySchema,
} from '@wtl/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Roles } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { AppointmentsService } from './appointments.service.js';

const slotsQuery = z.object({ days: z.coerce.number().int().min(1).max(30).default(14) });

@Controller()
export class AppointmentsController {
  constructor(private readonly appointments: AppointmentsService) {}

  @Roles('expert')
  @Get('experts/me/availability')
  async myAvailability(@CurrentUser() user: AuthUser) {
    return { slots: await this.appointments.getAvailability(user.id) };
  }

  @Roles('expert')
  @Put('experts/me/availability')
  async setMyAvailability(
    @CurrentUser() user: AuthUser,
    @Body(new ZodPipe(setAvailabilitySchema)) body: z.infer<typeof setAvailabilitySchema>,
    @Req() req: Request,
  ) {
    return { slots: await this.appointments.setAvailability(user.id, body.slots, req.ip) };
  }

  @Get('appointments')
  async list(@CurrentUser() user: AuthUser) {
    return { appointments: await this.appointments.listFor(user) };
  }

  @Get('cases/:caseId/appointments')
  async forCase(@CurrentUser() user: AuthUser, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return { appointments: await this.appointments.listForCase(user, caseId) };
  }

  @Roles('client')
  @Get('cases/:caseId/slots')
  slots(
    @CurrentUser() user: AuthUser,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Query(new ZodPipe(slotsQuery)) query: z.infer<typeof slotsQuery>,
  ) {
    return this.appointments.slotsForCase(user, caseId, query.days);
  }

  @Roles('client')
  @Post('cases/:caseId/appointments')
  book(
    @CurrentUser() user: AuthUser,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body(new ZodPipe(bookAppointmentSchema)) body: BookAppointmentInput,
    @Req() req: Request,
  ) {
    return this.appointments.book(user, caseId, body, req.ip);
  }

  @Roles('expert')
  @HttpCode(200)
  @Post('appointments/:id/confirm')
  confirm(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(confirmAppointmentSchema)) body: ConfirmAppointmentInput,
    @Req() req: Request,
  ) {
    return this.appointments.confirm(user, id, body.meetingLink, req.ip);
  }

  @HttpCode(200)
  @Post('appointments/:id/cancel')
  cancel(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(cancelAppointmentSchema)) _body: object,
    @Req() req: Request,
  ) {
    return this.appointments.cancel(user, id, req.ip);
  }

  @Roles('expert')
  @HttpCode(200)
  @Post('appointments/:id/complete')
  complete(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.appointments.complete(user, id, req.ip);
  }
}

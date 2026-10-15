import { Body, Controller, Delete, Get, HttpCode, Param, ParseUUIDPipe, Patch, Post, Req } from '@nestjs/common';
import {
  type AuthUser,
  type HomeworkInput,
  type HomeworkSubmitInput,
  type MoodInput,
  type SaveAssessmentInput,
  type SessionNoteInput,
  type SetSharedInput,
  type UpdateSessionNoteInput,
  homeworkInputSchema,
  homeworkSubmitSchema,
  moodInputSchema,
  saveAssessmentSchema,
  sessionNoteSchema,
  setSharedSchema,
  updateSessionNoteSchema,
} from '@wtl/shared';
import type { Request } from 'express';
import { CurrentUser, Roles } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { CareService } from './care.service.js';

/** Ghi chu buoi: chi chuyen gia tac gia. Khach va quan tri vien khong co duong vao. */
@Roles('expert')
@Controller()
export class SessionNotesController {
  constructor(private readonly care: CareService) {}

  @Post('cases/:caseId/notes')
  create(
    @CurrentUser() user: AuthUser,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body(new ZodPipe(sessionNoteSchema)) body: SessionNoteInput,
    @Req() req: Request,
  ) {
    return this.care.createNote(user, caseId, body, req.ip);
  }

  @Get('cases/:caseId/notes')
  async list(@CurrentUser() user: AuthUser, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return { notes: await this.care.listNotes(user, caseId) };
  }

  @Patch('notes/:id')
  update(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(updateSessionNoteSchema)) body: UpdateSessionNoteInput,
    @Req() req: Request,
  ) {
    return this.care.updateNote(user, id, body.body, req.ip);
  }

  @HttpCode(204)
  @Delete('notes/:id')
  async remove(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request): Promise<void> {
    await this.care.deleteNote(user, id, req.ip);
  }
}

/** Nhat ky tam trang va ket qua tu danh gia: chi khach so huu. */
@Roles('client')
@Controller()
export class TrackingController {
  constructor(private readonly care: CareService) {}

  @Post('mood')
  addMood(@CurrentUser() user: AuthUser, @Body(new ZodPipe(moodInputSchema)) body: MoodInput) {
    return this.care.addMood(user, body);
  }

  @Get('mood')
  async listMood(@CurrentUser() user: AuthUser) {
    return { entries: await this.care.listMood(user) };
  }

  @Patch('mood/:id/shared')
  setMoodShared(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(setSharedSchema)) body: SetSharedInput,
  ) {
    return this.care.setMoodShared(user, id, body.shared);
  }

  @HttpCode(204)
  @Delete('mood/:id')
  async deleteMood(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.care.deleteMood(user, id);
  }

  @Post('assessments')
  saveAssessment(@CurrentUser() user: AuthUser, @Body(new ZodPipe(saveAssessmentSchema)) body: SaveAssessmentInput) {
    return this.care.saveAssessment(user, body);
  }

  @Get('assessments/mine')
  async listAssessments(@CurrentUser() user: AuthUser) {
    return { results: await this.care.listAssessments(user) };
  }

  @Patch('assessments/:id/shared')
  setAssessmentShared(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(setSharedSchema)) body: SetSharedInput,
  ) {
    return this.care.setAssessmentShared(user, id, body.shared);
  }

  @HttpCode(204)
  @Delete('assessments/:id')
  async deleteAssessment(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    await this.care.deleteAssessment(user, id);
  }
}

@Controller()
export class CaseCareController {
  constructor(private readonly care: CareService) {}

  /** Chuyen gia xem phan khach da chu dong chia se. */
  @Roles('expert')
  @Get('cases/:caseId/client-tracking')
  clientTracking(@CurrentUser() user: AuthUser, @Param('caseId', ParseUUIDPipe) caseId: string, @Req() req: Request) {
    return this.care.clientTracking(user, caseId, req.ip);
  }

  @Roles('expert')
  @Post('cases/:caseId/homework')
  createHomework(
    @CurrentUser() user: AuthUser,
    @Param('caseId', ParseUUIDPipe) caseId: string,
    @Body(new ZodPipe(homeworkInputSchema)) body: HomeworkInput,
    @Req() req: Request,
  ) {
    return this.care.createHomework(user, caseId, body, req.ip);
  }

  /** Khach cua ca va chuyen gia phu trach; quan tri vien nhan 404. */
  @Roles('client', 'expert')
  @Get('cases/:caseId/homework')
  async listHomework(@CurrentUser() user: AuthUser, @Param('caseId', ParseUUIDPipe) caseId: string) {
    return { homework: await this.care.listHomework(user, caseId) };
  }

  @Roles('client')
  @Patch('homework/:id/submit')
  submitHomework(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(homeworkSubmitSchema)) body: HomeworkSubmitInput,
    @Req() req: Request,
  ) {
    return this.care.submitHomework(user, id, body, req.ip);
  }
}

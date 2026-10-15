import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Put, Query, Req } from '@nestjs/common';
import {
  type AuthUser,
  type QuestionInput,
  type SubmitScreeningInput,
  type TransitionInput,
  CASE_STATUSES,
  RISK_LEVELS,
  adminNoteSchema,
  questionInputSchema,
  submitScreeningSchema,
  transitionSchema,
} from '@wtl/shared';
import type { Request } from 'express';
import { z } from 'zod';
import { CurrentUser, Public, Roles } from '../common/decorators.js';
import { ZodPipe } from '../common/zod.pipe.js';
import { CasesService } from './cases.service.js';
import { ScreeningService } from './screening.service.js';

const adminCaseQuery = z.object({
  status: z.enum(CASE_STATUSES).optional(),
  riskLevel: z.enum(RISK_LEVELS).optional(),
});

@Controller()
export class ScreeningController {
  constructor(
    private readonly screening: ScreeningService,
    private readonly cases: CasesService,
  ) {}

  @Public()
  @Get('screening/questions')
  async questions() {
    return { questions: await this.screening.publicQuestions(), hotlines: this.cases.hotlines() };
  }
}

@Roles('admin')
@Controller('admin/screening-questions')
export class AdminScreeningController {
  constructor(private readonly screening: ScreeningService) {}

  @Get()
  async list() {
    return { questions: await this.screening.adminList() };
  }

  @Post()
  create(@CurrentUser() actor: AuthUser, @Body(new ZodPipe(questionInputSchema)) body: QuestionInput, @Req() req: Request) {
    return this.screening.create(body, actor.id, req.ip);
  }

  @Put(':id')
  update(
    @CurrentUser() actor: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(questionInputSchema)) body: QuestionInput,
    @Req() req: Request,
  ) {
    return this.screening.update(id, body, actor.id, req.ip);
  }
}

@Controller('cases')
export class CasesController {
  constructor(private readonly cases: CasesService) {}

  @Roles('client')
  @Post()
  submit(@CurrentUser() user: AuthUser, @Body(new ZodPipe(submitScreeningSchema)) body: SubmitScreeningInput, @Req() req: Request) {
    return this.cases.submit(user, body, req.ip);
  }

  @Roles('client')
  @Get('mine')
  async mine(@CurrentUser() user: AuthUser) {
    return { cases: await this.cases.listMine(user) };
  }

  // Quyen truy cap theo doi tuong duoc kiem tra trong service (khach/chuyen gia/admin thay noi dung khac nhau).
  @Get(':id')
  detail(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string, @Req() req: Request) {
    return this.cases.getDetail(user, id, req.ip);
  }

  @Roles('expert', 'admin')
  @HttpCode(200)
  @Post(':id/transition')
  transition(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(transitionSchema)) body: TransitionInput,
    @Req() req: Request,
  ) {
    return this.cases.transition(user, id, body, req.ip);
  }
}

@Roles('expert')
@Controller('expert/cases')
export class ExpertCasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    return { cases: await this.cases.listForExpert(user) };
  }
}

@Roles('admin')
@Controller('admin/cases')
export class AdminCasesController {
  constructor(private readonly cases: CasesService) {}

  @Get()
  async list(@Query(new ZodPipe(adminCaseQuery)) query: z.infer<typeof adminCaseQuery>) {
    return { cases: await this.cases.listForAdmin(query) };
  }

  @HttpCode(200)
  @Post(':id/note')
  note(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodPipe(adminNoteSchema)) body: { note: string },
    @Req() req: Request,
  ) {
    return this.cases.setAdminNote(user, id, body.note, req.ip);
  }
}

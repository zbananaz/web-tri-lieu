import { Module } from '@nestjs/common';
import { ExpertsModule } from '../experts/experts.module.js';
import {
  AdminCasesController,
  AdminScreeningController,
  CasesController,
  ExpertCasesController,
  ScreeningController,
} from './cases.controller.js';
import { CasesService } from './cases.service.js';
import { ScreeningService } from './screening.service.js';

@Module({
  imports: [ExpertsModule],
  controllers: [ScreeningController, AdminScreeningController, CasesController, ExpertCasesController, AdminCasesController],
  providers: [CasesService, ScreeningService],
  exports: [CasesService],
})
export class CasesModule {}

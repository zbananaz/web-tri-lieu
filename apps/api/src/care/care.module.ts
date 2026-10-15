import { Module } from '@nestjs/common';
import { CasesModule } from '../cases/cases.module.js';
import { CaseCareController, SessionNotesController, TrackingController } from './care.controller.js';
import { CareService } from './care.service.js';

@Module({
  imports: [CasesModule],
  controllers: [SessionNotesController, TrackingController, CaseCareController],
  providers: [CareService],
})
export class CareModule {}

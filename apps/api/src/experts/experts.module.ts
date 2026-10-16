import { Module } from '@nestjs/common';
import { AdminExpertsController, ExpertsController } from './experts.controller.js';
import { ExpertsService } from './experts.service.js';

@Module({
  controllers: [ExpertsController, AdminExpertsController],
  providers: [ExpertsService],
  exports: [ExpertsService],
})
export class ExpertsModule {}

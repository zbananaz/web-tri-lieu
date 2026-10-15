import { Module } from '@nestjs/common';
import { AdminUploadsController, UploadsController } from './uploads.controller.js';

@Module({ controllers: [AdminUploadsController, UploadsController] })
export class UploadsModule {}

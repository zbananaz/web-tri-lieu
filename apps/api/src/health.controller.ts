import { Controller, Get } from '@nestjs/common';
import { Public } from './common/decorators.js';

@Controller('health')
export class HealthController {
  @Public()
  @Get()
  health() {
    return { status: 'ok' };
  }
}

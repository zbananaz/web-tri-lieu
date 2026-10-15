import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard } from '@nestjs/throttler';
import { AuthController } from './auth.controller.js';
import { AuthGuard, RolesGuard } from './auth.guard.js';
import { AuthService } from './auth.service.js';
import { SessionService } from './session.service.js';

@Global()
@Module({
  controllers: [AuthController],
  providers: [
    AuthService,
    SessionService,
    // Thu tu guard: gioi han toc do -> xac thuc -> vai tro.
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: AuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
  ],
  exports: [SessionService],
})
export class AuthModule {}

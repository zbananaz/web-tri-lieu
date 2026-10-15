import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppointmentsModule } from './appointments/appointments.module.js';
import { ArticlesModule } from './articles/articles.module.js';
import { AuditModule } from './audit/audit.service.js';
import { CareModule } from './care/care.module.js';
import { ChatModule } from './chat/chat.module.js';
import { AuthModule } from './auth/auth.module.js';
import { env } from './config/env.js';
import { CasesModule } from './cases/cases.module.js';
import { DbModule } from './db/db.module.js';
import { ExpertsModule } from './experts/experts.module.js';
import { MailModule } from './mail/mailer.service.js';
import { NotificationsModule } from './notifications/notifications.module.js';
import { HealthController } from './health.controller.js';
import { ReviewsModule } from './reviews/reviews.module.js';
import { UploadsModule } from './uploads/uploads.module.js';
import { AdminAuditController, AdminUsersController } from './users/admin-users.controller.js';

@Module({
  imports: [
    // Gioi han chung 120 request/phut/IP; route nhay cam (dang nhap...) dat nguong rieng bang @Throttle.
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: env.nodeEnv === 'test' ? 100_000 : 120 }]),
    DbModule,
    AuditModule,
    MailModule,
    NotificationsModule,
    AuthModule,
    ExpertsModule,
    CasesModule,
    AppointmentsModule,
    ChatModule,
    CareModule,
    ReviewsModule,
    ArticlesModule,
    UploadsModule,
  ],
  controllers: [HealthController, AdminUsersController, AdminAuditController],
})
export class AppModule {}

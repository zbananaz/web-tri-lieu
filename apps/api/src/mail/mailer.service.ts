import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Global, Injectable, Logger, Module, type OnModuleInit } from '@nestjs/common';
import nodemailer, { type Transporter } from 'nodemailer';
import { env } from '../config/env.js';

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
}

/**
 * Gui thu qua SMTP khi co SMTP_URL. Khong co SMTP_URL:
 *  - dev/test: ghi thu ra data/outbox/*.json de doc lien ket (e2e dung cach nay);
 *  - production: KHONG gui va KHONG ghi ra dia (thu quen mat khau chua token), chi canh bao to khi khoi dong.
 * Khong bao gio log SMTP_URL (chua mat khau) hay noi dung thu.
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly log = new Logger(MailerService.name);
  private transporter?: Transporter;

  onModuleInit(): void {
    if (env.smtpUrl) {
      this.transporter = nodemailer.createTransport(env.smtpUrl);
    } else if (env.isProd) {
      this.log.error('SMTP_URL chua duoc cau hinh: he thong KHONG gui email (quen mat khau se khong hoat dong).');
    }
  }

  async send(msg: MailMessage): Promise<void> {
    if (this.transporter) {
      await this.transporter.sendMail({ from: env.mailFrom, to: msg.to, subject: msg.subject, text: msg.text });
      return;
    }
    if (env.isProd) {
      this.log.warn('Bo qua gui email vi chua cau hinh SMTP_URL.');
      return;
    }
    await mkdir(env.outboxDir, { recursive: true });
    const name = `${Date.now()}-${randomBytes(4).toString('hex')}.json`;
    await writeFile(join(env.outboxDir, name), JSON.stringify({ ...msg, from: env.mailFrom }, null, 2), { flag: 'wx' });
  }
}

@Global()
@Module({ providers: [MailerService], exports: [MailerService] })
export class MailModule {}

import type { AddressInfo } from 'node:net';
import { simpleParser } from 'mailparser';
import { SMTPServer } from 'smtp-server';
import { env } from '../src/config/env.js';
import { MailerService } from '../src/mail/mailer.service.js';

/**
 * Kiem tra duong gui SMTP that (nodemailer -> may chu SMTP), khong phu thuoc nha cung cap nao:
 * dung mot may chu SMTP gia lap chay ngay trong test, doc lai thu nhan duoc.
 */
describe('MailerService qua SMTP', () => {
  const received: string[] = [];
  let server: SMTPServer;
  let port = 0;
  const mutableEnv = env as { smtpUrl?: string; mailFrom: string };
  const before = { smtpUrl: mutableEnv.smtpUrl, mailFrom: mutableEnv.mailFrom };

  beforeAll(async () => {
    server = new SMTPServer({
      authOptional: true,
      disabledCommands: ['STARTTLS'],
      onData(stream, _session, done) {
        const chunks: Buffer[] = [];
        stream.on('data', (c: Buffer) => chunks.push(c));
        stream.on('end', () => {
          received.push(Buffer.concat(chunks).toString('utf8'));
          done();
        });
      },
    });
    await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
    port = (server.server.address() as AddressInfo).port;
  });

  afterAll(async () => {
    mutableEnv.smtpUrl = before.smtpUrl;
    mutableEnv.mailFrom = before.mailFrom;
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });

  it('gui thu that khi co SMTP_URL, noi dung tieng Viet khong bi hong', async () => {
    mutableEnv.smtpUrl = `smtp://127.0.0.1:${port}`;
    mutableEnv.mailFrom = 'Tri Lieu <no-reply@example.test>';
    const mailer = new MailerService();
    mailer.onModuleInit();

    await mailer.send({ to: 'khach@example.test', subject: 'Đặt lại mật khẩu', text: 'Liên kết: http://localhost:3000/reset-password#token=abc' });

    expect(received).toHaveLength(1);
    const mail = await simpleParser(received[0]!);
    expect(mail.subject).toBe('Đặt lại mật khẩu');
    expect(mail.text).toContain('Liên kết: http://localhost:3000/reset-password#token=abc');
    expect(mail.to).toMatchObject({ text: 'khach@example.test' });
    expect(mail.from?.value[0]).toMatchObject({ name: 'Tri Lieu', address: 'no-reply@example.test' });
  });
});

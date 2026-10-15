import { Injectable, type OnApplicationBootstrap, type OnApplicationShutdown } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { CHAT_OPEN_STATUSES, type AuthUser, type ChatMessage } from '@wtl/shared';
import { parseCookie } from 'cookie';
import { Server, type Socket } from 'socket.io';
import { SessionService } from '../auth/session.service.js';
import { CasesService } from '../cases/cases.service.js';
import { SESSION_COOKIE } from '../common/origin.middleware.js';
import { env } from '../config/env.js';

interface SocketData {
  user: AuthUser;
}

/**
 * Chi dung de DAY tin nhan toi nguoi dang online. Moi tin nhan van duoc ghi qua REST (co kiem tra quyen,
 * gioi han toc do), nen socket khong co duong ghi nao.
 */
@Injectable()
export class RealtimeService implements OnApplicationBootstrap, OnApplicationShutdown {
  private io?: Server;

  constructor(
    private readonly adapterHost: HttpAdapterHost,
    private readonly sessions: SessionService,
    private readonly cases: CasesService,
  ) {}

  onApplicationBootstrap(): void {
    const allowed = new Set([env.webOrigin]);
    const io = new Server(this.adapterHost.httpAdapter.getHttpServer(), {
      path: '/socket.io',
      serveClient: false,
      cors: { origin: [...allowed], credentials: true },
      // Chong CSWSH: trinh duyet phai den tu dung Origin; client khong phai trinh duyet (mobile) khong gui Origin.
      allowRequest: (req, cb) => {
        const origin = req.headers.origin;
        cb(null, !origin || allowed.has(origin));
      },
    });
    this.io = io;

    io.use(async (socket: Socket, next) => {
      try {
        const bearer = typeof socket.handshake.auth?.token === 'string' ? socket.handshake.auth.token : undefined;
        const cookieToken = parseCookie(socket.handshake.headers.cookie ?? '')[SESSION_COOKIE];
        const token = bearer ?? cookieToken;
        const resolved = token ? await this.sessions.resolve(token) : null;
        if (!resolved) return next(new Error('unauthorized'));
        (socket.data as SocketData).user = resolved.user;
        next();
      } catch {
        next(new Error('unauthorized'));
      }
    });

    io.on('connection', (socket) => {
      const user = (socket.data as SocketData).user;
      socket.on('join', async (caseId: unknown, ack?: (res: { ok: boolean }) => void) => {
        try {
          if (typeof caseId !== 'string') throw new Error('bad');
          const c = await this.cases.assertAccess(user, caseId); // cung quy tac truy cap theo doi tuong
          if (user.role !== 'admin' && !CHAT_OPEN_STATUSES.includes(c.status) && c.status !== 'closed') throw new Error('closed');
          await socket.join(`case:${caseId}`);
          ack?.({ ok: true });
        } catch {
          ack?.({ ok: false });
        }
      });
    });
  }

  emitMessage(message: ChatMessage): void {
    this.io?.to(`case:${message.caseId}`).emit('message', message);
  }

  async onApplicationShutdown(): Promise<void> {
    try {
      await this.io?.close();
    } catch {
      /* may chu http co the da dong */
    }
  }
}

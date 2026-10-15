import type { AuthUser } from '@wtl/shared';

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      sessionId?: string;
      authVia?: 'cookie' | 'bearer';
    }
  }
}

export {};

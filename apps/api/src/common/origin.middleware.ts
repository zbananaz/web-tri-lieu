import type { RequestHandler } from 'express';

export const SESSION_COOKIE = 'wtl_session';
const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Chong CSRF cho request doi du lieu:
 * - Co header Origin => phai nam trong danh sach cho phep.
 * - Khong co Origin => chi duoc khi KHONG dung cookie phien (client mobile/curl dung Bearer).
 */
export function originCheck(allowedOrigins: string[]): RequestHandler {
  const allowed = new Set(allowedOrigins);
  return (req, res, next) => {
    if (SAFE_METHODS.has(req.method)) return next();
    const origin = req.headers.origin;
    const deny = () => res.status(403).json({ statusCode: 403, message: 'Nguồn yêu cầu không hợp lệ' });
    if (origin) return allowed.has(origin) ? next() : deny();
    if (req.cookies?.[SESSION_COOKIE]) return deny();
    return next();
  };
}

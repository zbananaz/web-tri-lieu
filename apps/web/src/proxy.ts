import { type NextRequest, NextResponse } from 'next/server';

/**
 * Chi la tien ich UX: chua dang nhap thi chuyen thang toi trang dang nhap.
 * Bao mat that (xac thuc + phan quyen) nam o may chu API, khong o day.
 */
export function proxy(req: NextRequest) {
  if (req.cookies.has('wtl_session')) return NextResponse.next();
  const url = req.nextUrl.clone();
  const next = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = '/login';
  url.search = `?next=${encodeURIComponent(next)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ['/me/:path*', '/expert/:path*', '/admin/:path*'],
};

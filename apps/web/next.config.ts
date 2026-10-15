import type { NextConfig } from 'next';

// May chu API (NestJS). Trinh duyet chi noi chuyen voi Next qua /api/* (cung origin => cookie phien, khong can CORS).
const API = process.env.API_INTERNAL_URL ?? 'http://127.0.0.1:4000';

const isDev = process.env.NODE_ENV !== 'production';
const realtime = process.env.NEXT_PUBLIC_REALTIME_URL?.replace(/\/$/, '');

// CSP khong nonce (trang tinh/ISR can script inline cua Next): chan tai script/frame/object tu nguon la,
// chan nhung trang vao iframe, gioi han noi nhan form. 'unsafe-inline' van can nen day KHONG thay the viec
// loc HTML bai viet o may chu.
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${realtime ? ` ${realtime} ${realtime.replace(/^http/, 'ws')}` : ''}${isDev ? ' ws: wss:' : ''}`,
  "frame-src 'none'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "object-src 'none'",
  "form-action 'self'",
].join('; ');

const securityHeaders = [
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: csp },
  ...(process.env.NODE_ENV === 'production'
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' }]
    : []),
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // Socket.IO goi /socket.io/ (co dau gach cheo cuoi): Next khong duoc 308 chuyen huong, upgrade WebSocket khong theo redirect.
  skipTrailingSlashRedirect: true,
  turbopack: {
    rules: {
      '*.css': {
        loaders: ['@tailwindcss/turbopack'],
        as: '*.css',
      },
    },
  },
  async rewrites() {
    return [
      { source: '/api/:path*', destination: `${API}/api/:path*` },
      // engine.io chi phuc vu '/socket.io/' (co gach cheo cuoi); ':path*' rong se bo gach cheo nen khai bao rieng.
      { source: '/socket.io', destination: `${API}/socket.io/` },
      { source: '/socket.io/:path+', destination: `${API}/socket.io/:path+` },
    ];
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};

export default nextConfig;

import type { Metadata, Viewport } from 'next';
import { Be_Vietnam_Pro } from 'next/font/google';
import { AuthProvider } from '@/lib/auth';
import './globals.css';

const font = Be_Vietnam_Pro({
  variable: '--font-be-vietnam',
  subsets: ['latin', 'vietnamese'],
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export const metadata: Metadata = {
  metadataBase: new URL(SITE),
  title: { default: 'Trị Liệu — Đồng hành cùng sức khỏe tinh thần', template: '%s | Trị Liệu' },
  description: 'Kết nối bạn với chuyên gia tâm lý phù hợp: sàng lọc riêng tư, đặt lịch dễ dàng, trò chuyện an toàn.',
  openGraph: { type: 'website', locale: 'vi_VN', siteName: 'Trị Liệu' },
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#247a70' };

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="vi" className={font.variable}>
      <body className="flex min-h-dvh flex-col">
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}

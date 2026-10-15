import type { Metadata } from 'next';

// Trang nay xu ly token dat lai mat khau: khong gui Referer di dau, khong cho cong cu tim kiem lap chi muc.
export const metadata: Metadata = { title: 'Đặt lại mật khẩu', referrer: 'no-referrer', robots: { index: false, follow: false } };

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}

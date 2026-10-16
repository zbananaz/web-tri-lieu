'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { HOME_BY_ROLE, useAuth } from '@/lib/auth';
import { LeafMark } from './LeafMark';
import { NotificationBell } from './NotificationBell';
import { Button, LinkButton } from './ui';

const LINKS = [
  { href: '/experts', label: 'Chuyên gia' },
  { href: '/articles', label: 'Bài viết' },
  { href: '/tu-danh-gia', label: 'Tự đánh giá' },
  { href: '/ve-chung-toi', label: 'Về chúng tôi' },
];

export function Logo() {
  return (
    <Link href="/" className="flex items-center gap-2.5 font-[family-name:var(--font-display)] text-xl font-semibold text-brand-700">
      <span aria-hidden className="grid size-9 place-items-center rounded-full bg-brand-600 text-brand-50">
        <LeafMark className="size-5" />
      </span>
      Trị Liệu
    </Link>
  );
}

export function SiteHeader() {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  const doLogout = async () => {
    await logout();
    setOpen(false);
    router.push('/');
  };

  const authArea = loading ? null : user ? (
    <>
      <LinkButton href={HOME_BY_ROLE[user.role]} variant="secondary">
        Khu của tôi
      </LinkButton>
      <Button variant="ghost" onClick={doLogout}>
        Đăng xuất
      </Button>
    </>
  ) : (
    <>
      <LinkButton href="/login" variant="ghost">
        Đăng nhập
      </LinkButton>
      <LinkButton href="/screening">Bắt đầu sàng lọc</LinkButton>
    </>
  );

  return (
    <header className="sticky top-0 z-30 border-b border-line bg-bg/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Logo />
        <nav aria-label="Chính" className="hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className="rounded-full px-4 py-2 text-sm font-medium transition-colors hover:bg-brand-100/60">
              {l.label}
            </Link>
          ))}
          <span className="mx-2 h-6 w-px bg-line" />
          {user && <NotificationBell />}
          {authArea}
        </nav>
        <div className="flex items-center gap-2 lg:hidden">
          {user && <NotificationBell menuClass="max-lg:fixed max-lg:inset-x-4 max-lg:top-16 max-lg:!w-auto lg:right-0" />}
        <button
          type="button"
          className="grid size-11 place-items-center rounded-full border border-line"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Đóng menu' : 'Mở menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <span aria-hidden className="text-xl leading-none">
            {open ? '✕' : '☰'}
          </span>
        </button>
        </div>
      </div>
      {open && (
        <nav id="mobile-menu" aria-label="Di động" className="flex flex-col gap-2 border-t border-line bg-bg px-4 py-4 lg:hidden">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-3 font-medium hover:bg-brand-50">
              {l.label}
            </Link>
          ))}
          <div className="mt-2 flex flex-col gap-2 [&>*]:w-full" onClick={() => setOpen(false)}>
            {authArea}
          </div>
        </nav>
      )}
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="mt-16 border-t border-line bg-surface">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 text-sm text-muted sm:px-6 md:grid-cols-3">
        <div>
          <Logo />
          <p className="mt-3">Kết nối bạn với chuyên gia tâm lý phù hợp, trong không gian riêng tư và an toàn.</p>
        </div>
        <div>
          <p className="font-semibold text-ink">Khám phá</p>
          <ul className="mt-2 space-y-1.5">
            <li>
              <Link href="/experts" className="hover:underline">
                Đội ngũ chuyên gia
              </Link>
            </li>
            <li>
              <Link href="/articles" className="hover:underline">
                Bài viết
              </Link>
            </li>
            <li>
              <Link href="/ve-chung-toi" className="hover:underline">
                Về chúng tôi
              </Link>
            </li>
            <li>
              <Link href="/screening" className="hover:underline">
                Sàng lọc ban đầu
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <p className="font-semibold text-ink">Cần hỗ trợ khẩn cấp?</p>
          <p className="mt-2">
            Nếu bạn hoặc người thân đang gặp nguy hiểm, hãy gọi <strong>115</strong> hoặc đến cơ sở y tế gần nhất. Nền tảng này không thay thế dịch vụ cấp cứu.
          </p>
        </div>
      </div>
    </footer>
  );
}

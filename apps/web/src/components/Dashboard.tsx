'use client';

import type { Role } from '@wtl/shared';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { type ReactNode, useEffect } from 'react';
import { HOME_BY_ROLE, useAuth } from '@/lib/auth';
import { NotificationBell } from './NotificationBell';
import { Logo } from './SiteHeader';
import { Button, Loading } from './ui';

export interface NavItem {
  href: string;
  label: string;
  exact?: boolean;
}

/**
 * Khung khu rieng theo vai tro. Chuyen huong o day chi la tien loi giao dien;
 * quyen that su duoc may chu kiem tra o moi request.
 */
export function Dashboard({ role, title, nav, children }: { role: Role; title: string; nav: NavItem[]; children: ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (loading) return;
    if (!user) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (user.role !== role) router.replace(HOME_BY_ROLE[user.role]);
  }, [loading, user, role, router, pathname]);

  if (loading || !user || user.role !== role) return <Loading />;

  const active = (n: NavItem) => (n.exact ? pathname === n.href : pathname === n.href || pathname.startsWith(`${n.href}/`));

  return (
    <div className="flex min-h-dvh flex-col lg:flex-row">
      <aside className="border-b border-line bg-surface lg:sticky lg:top-0 lg:h-dvh lg:w-64 lg:shrink-0 lg:border-b-0 lg:border-r">
        <div className="flex items-center justify-between gap-3 px-4 py-3 lg:px-5 lg:py-5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <Logo />
            <p className="text-sm text-muted">{title}</p>
          </div>
          <NotificationBell menuClass="right-0 lg:right-auto lg:left-0" />
        </div>
        <nav aria-label={title} className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:px-3 lg:pb-0">
          {nav.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              aria-current={active(n) ? 'page' : undefined}
              className={`whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-medium ${
                active(n) ? 'bg-brand-600 text-white' : 'hover:bg-brand-50'
              }`}
            >
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="hidden border-t border-line p-4 lg:absolute lg:inset-x-0 lg:bottom-0 lg:block">
          <p className="truncate text-sm font-medium">{user.fullName}</p>
          <p className="truncate text-xs text-muted">{user.email}</p>
          <Button
            variant="secondary"
            className="mt-3 w-full"
            onClick={async () => {
              await logout();
              router.push('/');
            }}
          >
            Đăng xuất
          </Button>
        </div>
      </aside>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-5xl">{children}</div>
        <div className="mt-10 lg:hidden">
          <Button
            variant="secondary"
            className="w-full"
            onClick={async () => {
              await logout();
              router.push('/');
            }}
          >
            Đăng xuất ({user.fullName})
          </Button>
        </div>
      </main>
    </div>
  );
}

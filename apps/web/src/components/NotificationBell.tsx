'use client';

import type { NotificationDto } from '@wtl/shared';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api';
import { formatDateTime } from '@/lib/format';

const POLL_MS = 30_000;

/** Chuong thong bao: hoi may chu moi 30 giay khi tab dang hien. */
export function NotificationBell({ menuClass = 'right-0' }: { menuClass?: string }) {
  const [items, setItems] = useState<NotificationDto[]>([]);
  const [unread, setUnread] = useState(0);
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const r = await api<{ notifications: NotificationDto[]; unread: number }>('/notifications');
      setItems(r.notifications);
      setUnread(r.unread);
    } catch {
      /* thong bao chi la tien ich: loi mang thi bo qua, lan hoi sau se thu lai */
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(() => void load(), 0);
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const markAll = async () => {
    setItems((l) => l.map((n) => ({ ...n, read: true })));
    setUnread(0);
    try {
      await api('/notifications/read', { method: 'POST', body: { all: true } });
    } catch {
      void load();
    }
  };

  const openOne = async (n: NotificationDto) => {
    setOpen(false);
    if (n.read) return;
    setItems((l) => l.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
    setUnread((u) => Math.max(0, u - 1));
    try {
      await api('/notifications/read', { method: 'POST', body: { ids: [n.id] } });
    } catch {
      void load();
    }
  };

  return (
    <div ref={box} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="dialog"
        aria-label={unread > 0 ? `Thông báo, ${unread} chưa đọc` : 'Thông báo'}
        className="relative grid size-11 place-items-center rounded-full border border-line bg-surface hover:bg-brand-50"
      >
        <svg aria-hidden viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6" />
          <path d="M10 19a2 2 0 0 0 4 0" />
        </svg>
        {unread > 0 && (
          <span aria-hidden className="absolute -right-0.5 -top-0.5 grid min-w-5 place-items-center rounded-full bg-danger-600 px-1 text-xs font-bold text-white">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      {open && (
        <div
          role="dialog"
          aria-label="Thông báo"
          className={`absolute ${menuClass} z-40 mt-2 w-[min(22rem,calc(100vw-2rem))] rounded-3xl border border-line bg-surface p-3 shadow-lift`}
        >
          <div className="flex items-center justify-between px-2 pb-2">
            <p className="font-semibold">Thông báo</p>
            {unread > 0 && (
              <button type="button" onClick={markAll} className="text-sm font-semibold text-brand-700 hover:underline">
                Đánh dấu đã đọc
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="px-2 py-6 text-center text-sm text-muted">Chưa có thông báo nào.</p>
          ) : (
            <ul className="max-h-96 overflow-y-auto">
              {items.map((n) => {
                const inner = (
                  <>
                    <span className={`block text-sm ${n.read ? '' : 'font-semibold'}`}>{n.title}</span>
                    <span className="block text-xs text-muted">{formatDateTime(n.createdAt)}</span>
                  </>
                );
                const cls = `block rounded-2xl px-3 py-2.5 hover:bg-brand-50 ${n.read ? '' : 'bg-brand-50/60'}`;
                return (
                  <li key={n.id}>
                    {n.link ? (
                      <Link href={n.link} onClick={() => void openOne(n)} className={cls}>
                        {inner}
                      </Link>
                    ) : (
                      <button type="button" onClick={() => void openOne(n)} className={`${cls} w-full text-left`}>
                        {inner}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

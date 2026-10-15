'use client';

import type { ChatMessage } from '@wtl/shared';
import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { io, type Socket } from 'socket.io-client';
import { api, errorMessage } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { formatDateTime } from '@/lib/format';
import { Alert, Button, Loading } from './ui';

const merge = (list: ChatMessage[], incoming: ChatMessage[]): ChatMessage[] => {
  const map = new Map(list.map((m) => [m.id, m]));
  for (const m of incoming) map.set(m.id, m);
  return [...map.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
};

/**
 * Khung chat theo ca. Ghi tin luon qua REST (co kiem tra quyen); Socket.IO chi de nhan tin tuc thi.
 * Mat ket noi socket thi tu dong quay ve hoi dinh ky.
 */
export function Chat({ caseId, canSend, peerName }: { caseId: string; canSend: boolean; peerName?: string }) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [live, setLive] = useState(false);
  const bottom = useRef<HTMLDivElement>(null);

  const fetchAll = useCallback(async () => {
    try {
      const r = await api<{ messages: ChatMessage[] }>(`/cases/${caseId}/messages?limit=100`);
      setMessages((cur) => merge(cur ?? [], r.messages));
      if (user && user.role !== 'admin') void api(`/cases/${caseId}/messages/read`, { method: 'POST', body: {} }).catch(() => undefined);
    } catch (e) {
      setError(errorMessage(e));
    }
  }, [caseId, user]);

  useEffect(() => {
    const t = setTimeout(() => void fetchAll(), 0);
    return () => clearTimeout(t);
  }, [fetchAll]);

  // Ket noi realtime
  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_REALTIME_URL || undefined; // mac dinh: cung origin, qua rewrite
    const socket: Socket = io(url, { path: '/socket.io', withCredentials: true, transports: ['websocket', 'polling'] });
    const join = () => socket.emit('join', caseId, (res: { ok: boolean }) => setLive(!!res?.ok));
    socket.on('connect', join);
    socket.on('disconnect', () => setLive(false));
    socket.on('message', (m: ChatMessage) => {
      if (m.caseId !== caseId) return;
      setMessages((cur) => merge(cur ?? [], [m]));
      if (m.senderId !== user?.id && user?.role !== 'admin') void api(`/cases/${caseId}/messages/read`, { method: 'POST', body: {} }).catch(() => undefined);
    });
    return () => {
      socket.disconnect();
    };
  }, [caseId, user?.id, user?.role]);

  // Du phong: hoi dinh ky khi socket khong hoat dong
  useEffect(() => {
    if (live) return;
    const t = setInterval(() => void fetchAll(), 8000);
    return () => clearInterval(t);
  }, [live, fetchAll]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ block: 'end' });
  }, [messages?.length]);

  const send = async (e?: FormEvent) => {
    e?.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setError(null);
    try {
      const r = await api<{ message: ChatMessage }>(`/cases/${caseId}/messages`, { body: { body } });
      setMessages((cur) => merge(cur ?? [], [r.message]));
      setText('');
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setSending(false);
    }
  };

  if (messages === null) return error ? <Alert>{error}</Alert> : <Loading />;

  return (
    <section aria-label="Trò chuyện" className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface">
      <div className="flex items-center justify-between border-b border-line px-4 py-2.5 text-sm">
        <span className="font-semibold">{peerName ? `Trò chuyện với ${peerName}` : 'Cuộc trò chuyện'}</span>
        <span className={live ? 'text-ok-600' : 'text-muted'}>{live ? '● Trực tuyến' : '○ Đang cập nhật định kỳ'}</span>
      </div>
      <div className="h-[55dvh] min-h-64 space-y-3 overflow-y-auto bg-bg/60 p-4" role="log" aria-live="polite">
        {messages.length === 0 && <p className="py-10 text-center text-sm text-muted">Chưa có tin nhắn nào. Hãy gửi lời chào đầu tiên.</p>}
        {messages.map((m) => {
          const mine = m.senderId === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 sm:max-w-[70%] ${mine ? 'bg-brand-600 text-white' : 'border border-line bg-surface'}`}>
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-1 text-[11px] ${mine ? 'text-white/75' : 'text-muted'}`}>
                  {formatDateTime(m.createdAt)}
                  {mine && m.readAt ? ' · Đã xem' : ''}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={bottom} />
      </div>
      {error && (
        <div className="px-4 pt-3">
          <Alert>{error}</Alert>
        </div>
      )}
      {canSend ? (
        <form onSubmit={send} className="flex items-end gap-2 border-t border-line p-3">
          <label htmlFor="chat-input" className="sr-only">
            Nhập tin nhắn
          </label>
          <textarea
            id="chat-input"
            value={text}
            rows={1}
            maxLength={4000}
            placeholder="Nhập tin nhắn…"
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                void send();
              }
            }}
            className="max-h-32 min-h-11 flex-1 resize-none rounded-2xl border border-line px-3.5 py-2.5 focus:border-brand-500"
          />
          <Button type="submit" loading={sending} disabled={!text.trim()}>
            Gửi
          </Button>
        </form>
      ) : (
        <p className="border-t border-line p-3 text-center text-sm text-muted">Bạn chỉ có quyền xem cuộc trò chuyện này.</p>
      )}
    </section>
  );
}

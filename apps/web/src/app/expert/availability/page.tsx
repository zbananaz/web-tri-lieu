'use client';

import type { AvailabilitySlot } from '@wtl/shared';
import { useState } from 'react';
import { Alert, Button, Card, PageTitle, QueryState } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { minuteToTime, timeToMinute, WEEKDAY_LABELS } from '@/lib/format';
import { useQuery } from '@/lib/hooks';

interface Range {
  start: string;
  end: string;
}
// Hien thi Thu hai -> Chu nhat; du lieu: 0 = Chu nhat
const ORDER = [1, 2, 3, 4, 5, 6, 0];

export default function AvailabilityPage() {
  const q = useQuery<{ slots: AvailabilitySlot[] }>('/experts/me/availability');
  const [days, setDays] = useState<Record<number, Range[]>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Nap du lieu vao form khi tai xong (dieu chinh state trong luc render, theo huong dan cua React)
  const [seeded, setSeeded] = useState<typeof q.data>(null);
  if (q.data && q.data !== seeded) {
    const next: Record<number, Range[]> = {};
    for (const s of q.data.slots) (next[s.weekday] ??= []).push({ start: minuteToTime(s.startMinute), end: minuteToTime(s.endMinute) });
    setSeeded(q.data);
    setDays(next);
  }

  const update = (d: number, i: number, patch: Partial<Range>) => {
    setSaved(false);
    setDays((cur) => ({ ...cur, [d]: (cur[d] ?? []).map((r, idx) => (idx === i ? { ...r, ...patch } : r)) }));
  };
  const add = (d: number) => {
    setSaved(false);
    setDays((cur) => ({ ...cur, [d]: [...(cur[d] ?? []), { start: '09:00', end: '12:00' }] }));
  };
  const remove = (d: number, i: number) => {
    setSaved(false);
    setDays((cur) => ({ ...cur, [d]: (cur[d] ?? []).filter((_, idx) => idx !== i) }));
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const slots = Object.entries(days).flatMap(([d, rs]) =>
        rs.map((r) => ({ weekday: Number(d), startMinute: timeToMinute(r.start), endMinute: timeToMinute(r.end) })),
      );
      await api('/experts/me/availability', { method: 'PUT', body: { slots } });
      setSaved(true);
      await q.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageTitle title="Giờ rảnh hằng tuần">
        <Button onClick={save} loading={busy}>
          Lưu giờ rảnh
        </Button>
      </PageTitle>
      <p className="mb-4 text-sm text-muted">Khách chỉ đặt được các khung giờ nằm trong thời gian rảnh này (giờ Việt Nam).</p>
      <QueryState loading={q.loading} error={q.error} />
      {error && <Alert>{error}</Alert>}
      {saved && <Alert tone="ok">Đã lưu giờ rảnh.</Alert>}
      {q.data && (
        <div className="mt-4 space-y-3">
          {ORDER.map((d) => (
            <Card key={d} className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold">{WEEKDAY_LABELS[d]}</h2>
                <Button variant="ghost" onClick={() => add(d)}>
                  + Thêm khung giờ
                </Button>
              </div>
              {(days[d] ?? []).length === 0 && <p className="text-sm text-muted">Không nhận lịch.</p>}
              {(days[d] ?? []).map((r, i) => (
                <div key={i} className="flex flex-wrap items-center gap-2">
                  <label className="sr-only" htmlFor={`s-${d}-${i}`}>
                    Từ
                  </label>
                  <input id={`s-${d}-${i}`} type="time" value={r.start} onChange={(e) => update(d, i, { start: e.target.value })} className="min-h-11 rounded-xl border border-line px-3" />
                  <span aria-hidden>→</span>
                  <label className="sr-only" htmlFor={`e-${d}-${i}`}>
                    Đến
                  </label>
                  <input id={`e-${d}-${i}`} type="time" value={r.end} onChange={(e) => update(d, i, { end: e.target.value })} className="min-h-11 rounded-xl border border-line px-3" />
                  <Button variant="ghost" onClick={() => remove(d, i)} aria-label={`Xóa khung giờ ${i + 1} của ${WEEKDAY_LABELS[d]}`}>
                    Xóa
                  </Button>
                </div>
              ))}
            </Card>
          ))}
        </div>
      )}
    </>
  );
}

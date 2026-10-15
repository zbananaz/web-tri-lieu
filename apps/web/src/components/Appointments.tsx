'use client';

import type { AppointmentStatus, Role } from '@wtl/shared';
import { APPOINTMENT_STATUS_LABELS } from '@wtl/shared';
import { useMemo, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { apptTone, dayKey, formatDateTime, formatDayLabel, formatTime, MODE_LABELS } from '@/lib/format';
import { useQuery } from '@/lib/hooks';
import { Alert, Badge, Button, Card, Empty, QueryState, SelectField, TextArea, TextField } from './ui';

export interface Appointment {
  id: string;
  caseId: string;
  startsAt: string;
  endsAt: string;
  status: AppointmentStatus;
  mode: string;
  meetingLink: string | null;
  note: string | null;
  clientName: string;
  expertName: string;
}

/** Danh sach lich hen kem thao tac theo vai tro. */
const REVIEW_LABELS = { pending: 'Đang chờ duyệt', published: 'Đã đăng', hidden: 'Đã ẩn' } as const;

interface MyReview {
  appointmentId: string;
  rating: number;
  comment: string;
  status: keyof typeof REVIEW_LABELS;
}

/** Khach danh gia buoi da hoan thanh: chon sao, nhan xet tuy chon, cho quan tri duyet truoc khi hien cong khai. */
function ReviewBox({ appointmentId, mine, onSaved }: { appointmentId: string; mine?: MyReview; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (mine) {
    return (
      <p className="text-sm text-muted">
        Bạn đã đánh giá {mine.rating}/5 sao · {REVIEW_LABELS[mine.status]}
      </p>
    );
  }
  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        Đánh giá buổi hẹn
      </Button>
    );
  }
  const submit = async () => {
    if (!rating) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/appointments/${appointmentId}/review`, { body: { rating, comment: comment.trim() } });
      onSaved();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="w-full space-y-3 rounded-2xl bg-brand-50 p-4">
      <p className="font-semibold">Buổi hẹn này thế nào?</p>
      <div role="radiogroup" aria-label="Số sao" className="flex gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={rating === n}
            aria-label={`${n} sao`}
            onClick={() => setRating(n)}
            className={`grid size-11 place-items-center rounded-full border text-xl ${rating >= n ? 'border-warm-600 bg-warm-100 text-warm-600' : 'border-line bg-surface text-muted'}`}
          >
            ★
          </button>
        ))}
      </div>
      <TextArea label="Nhận xét (không bắt buộc)" rows={3} maxLength={1000} value={comment} onChange={(e) => setComment(e.target.value)} hint="Đánh giá được quản trị viên duyệt trước khi hiển thị, và không kèm tên của bạn." />
      {error && <Alert>{error}</Alert>}
      <div className="flex gap-2">
        <Button onClick={submit} loading={busy} disabled={!rating}>
          Gửi đánh giá
        </Button>
        <Button variant="ghost" onClick={() => setOpen(false)}>
          Để sau
        </Button>
      </div>
    </div>
  );
}

export function AppointmentList({ items, role, onChanged }: { items: Appointment[]; role: Role; onChanged: () => void }) {
  const [error, setError] = useState<string | null>(null);
  const [link, setLink] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const reviews = useQuery<{ reviews: MyReview[] }>(role === 'client' ? '/reviews/mine' : null);

  const act = async (id: string, action: 'confirm' | 'cancel' | 'complete') => {
    setBusy(id + action);
    setError(null);
    try {
      await api(`/appointments/${id}/${action}`, { method: 'POST', body: action === 'confirm' && link[id]?.trim() ? { meetingLink: link[id].trim() } : {} });
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (items.length === 0) return <Empty>Chưa có lịch hẹn nào.</Empty>;
  return (
    <div className="space-y-3">
      {error && <Alert>{error}</Alert>}
      {items.map((a) => {
        const past = new Date(a.startsAt) <= new Date();
        return (
          <Card key={a.id} className="space-y-3">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <p className="font-semibold">{formatDateTime(a.startsAt)}</p>
                <p className="text-sm text-muted">
                  {role === 'client' ? `Chuyên gia ${a.expertName}` : role === 'expert' ? `Khách ${a.clientName}` : `${a.clientName} ↔ ${a.expertName}`} · {MODE_LABELS[a.mode] ?? a.mode} · đến {formatTime(a.endsAt)}
                </p>
              </div>
              <Badge tone={apptTone(a.status)}>{APPOINTMENT_STATUS_LABELS[a.status]}</Badge>
            </div>
            {a.note && <p className="text-sm text-muted">Ghi chú: {a.note}</p>}
            {a.meetingLink && a.status === 'confirmed' && (
              <p className="text-sm">
                Phòng họp:{' '}
                <a href={a.meetingLink} target="_blank" rel="noopener noreferrer" className="font-semibold text-brand-700 underline">
                  {a.meetingLink}
                </a>
              </p>
            )}
            {role === 'expert' && a.status === 'requested' && (
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <TextField label="Liên kết phòng họp (không bắt buộc)" type="url" placeholder="https://…" value={link[a.id] ?? ''} onChange={(e) => setLink((l) => ({ ...l, [a.id]: e.target.value }))} />
                </div>
                <Button loading={busy === a.id + 'confirm'} onClick={() => act(a.id, 'confirm')}>
                  Xác nhận
                </Button>
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              {role === 'client' && a.status === 'completed' && reviews.data && (
                <ReviewBox appointmentId={a.id} mine={reviews.data.reviews.find((r) => r.appointmentId === a.id)} onSaved={() => void reviews.reload()} />
              )}
              {role === 'expert' && a.status === 'confirmed' && past && (
                <Button variant="secondary" loading={busy === a.id + 'complete'} onClick={() => act(a.id, 'complete')}>
                  Đánh dấu hoàn thành
                </Button>
              )}
              {(a.status === 'requested' || a.status === 'confirmed') && (
                <Button
                  variant="ghost"
                  loading={busy === a.id + 'cancel'}
                  onClick={() => {
                    if (window.confirm('Bạn chắc chắn muốn hủy lịch hẹn này?')) void act(a.id, 'cancel');
                  }}
                >
                  Hủy lịch
                </Button>
              )}
            </div>
          </Card>
        );
      })}
    </div>
  );
}

interface SlotsResponse {
  sessionMinutes: number;
  modes: string[];
  slots: string[];
}

/** Khach chon khung gio trong cua chuyen gia duoc phan va dat lich. */
export function BookingPanel({ caseId, onBooked }: { caseId: string; onBooked: () => void }) {
  const q = useQuery<SlotsResponse>(`/cases/${caseId}/slots?days=14`);
  const [picked, setPicked] = useState<string | null>(null);
  const [mode, setMode] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const days = useMemo(() => {
    const m = new Map<string, string[]>();
    for (const s of q.data?.slots ?? []) {
      const k = dayKey(s);
      m.set(k, [...(m.get(k) ?? []), s]);
    }
    return [...m.entries()];
  }, [q.data]);

  if (q.loading || q.error) return <QueryState loading={q.loading} error={q.error} />;
  if (!q.data) return null;
  const modes = q.data.modes;
  const effectiveMode = mode || modes[0] || 'online';

  const book = async () => {
    if (!picked) return;
    setBusy(true);
    setError(null);
    try {
      await api(`/cases/${caseId}/appointments`, { body: { startsAt: picked, mode: effectiveMode, ...(note.trim() ? { note: note.trim() } : {}) } });
      setPicked(null);
      setNote('');
      onBooked();
      await q.reload();
    } catch (e) {
      setError(errorMessage(e));
      await q.reload();
      setPicked(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold">Đặt lịch hẹn</h3>
        <p className="text-sm text-muted">Mỗi buổi {q.data.sessionMinutes} phút. Giờ hiển thị theo giờ Việt Nam.</p>
      </div>
      {days.length === 0 ? (
        <Empty>Chuyên gia chưa có khung giờ trống trong 14 ngày tới.</Empty>
      ) : (
        <div className="space-y-3">
          {days.map(([k, slots]) => (
            <div key={k}>
              <p className="mb-1.5 text-sm font-semibold capitalize">{formatDayLabel(slots[0]!)}</p>
              <div className="flex flex-wrap gap-2">
                {slots.map((s) => (
                  <button
                    key={s}
                    type="button"
                    aria-pressed={picked === s}
                    onClick={() => setPicked(s)}
                    className={`min-h-11 min-w-[4.5rem] rounded-2xl border px-3 text-sm font-medium ${picked === s ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface hover:bg-brand-50'}`}
                  >
                    {formatTime(s)}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
      {picked && (
        <div className="space-y-3 rounded-2xl bg-brand-50 p-4">
          <p className="font-semibold">Bạn chọn: {formatDateTime(picked)}</p>
          <SelectField label="Hình thức" value={effectiveMode} onChange={(e) => setMode(e.target.value)}>
            {modes.map((m) => (
              <option key={m} value={m}>
                {MODE_LABELS[m] ?? m}
              </option>
            ))}
          </SelectField>
          <TextArea label="Ghi chú cho chuyên gia (không bắt buộc)" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
          <Button onClick={book} loading={busy}>
            Xác nhận đặt lịch
          </Button>
        </div>
      )}
      {error && <Alert>{error}</Alert>}
    </Card>
  );
}

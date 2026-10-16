'use client';

import { ASSESSMENTS, type AssessmentResultDto, MOOD_LABELS, type MoodEntryDto } from '@wtl/shared';
import Link from 'next/link';
import { useState } from 'react';
import { Alert, Badge, Button, Card, Empty, LinkButton, PageTitle, QueryState, TextArea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useQuery } from '@/lib/hooks';

const FACES = ['😞', '🙁', '😐', '🙂', '😄'];

function ShareToggle({ shared, busy, onToggle }: { shared: boolean; busy: boolean; onToggle: () => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Badge tone={shared ? 'brand' : 'neutral'}>{shared ? 'Đang chia sẻ với chuyên gia' : 'Chỉ mình bạn thấy'}</Badge>
      <button type="button" disabled={busy} onClick={onToggle} className="text-sm font-semibold text-brand-700 hover:underline disabled:opacity-50">
        {shared ? 'Ngừng chia sẻ' : 'Chia sẻ với chuyên gia'}
      </button>
    </div>
  );
}

export default function MoodPage() {
  const moods = useQuery<{ entries: MoodEntryDto[] }>('/mood');
  const results = useQuery<{ results: AssessmentResultDto[] }>('/assessments/mine');
  const [mood, setMood] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [share, setShare] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const guard = async (id: string | null, fn: () => Promise<unknown>, reload: () => Promise<void>) => {
    setBusyId(id);
    setError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  };

  const add = async () => {
    if (!mood) return;
    setSaving(true);
    setError(null);
    try {
      await api('/mood', { body: { mood, shared: share, ...(note.trim() ? { note: note.trim() } : {}) } });
      setMood(null);
      setNote('');
      setShare(false); // moi muc moi mac dinh la rieng tu, khong "nho" lua chon chia se cua muc truoc
      await moods.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      <PageTitle title="Nhật ký tâm trạng" />
      <p className="mb-5 text-muted">
        Ghi lại cảm xúc mỗi ngày để bạn và chuyên gia thấy được diễn biến. Mặc định mọi mục đều <strong>riêng tư</strong>; chuyên gia chỉ thấy những mục bạn chủ động chia sẻ.
      </p>
      {error && (
        <div className="mb-4">
          <Alert>{error}</Alert>
        </div>
      )}

      <Card className="mb-6 space-y-4">
        <h2 className="text-lg font-semibold">Hôm nay bạn cảm thấy thế nào?</h2>
        <div role="radiogroup" aria-label="Tâm trạng" className="grid grid-cols-5 gap-2">
          {MOOD_LABELS.map((label, i) => {
            const v = i + 1;
            const on = mood === v;
            return (
              <button
                key={label}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setMood(v)}
                className={`flex min-h-16 flex-col items-center justify-center gap-1 rounded-2xl border px-1 py-2 text-xs font-medium sm:text-sm ${on ? 'border-brand-600 bg-brand-50' : 'border-line bg-surface hover:bg-brand-50/50'}`}
              >
                <span aria-hidden className="text-2xl">
                  {FACES[i]}
                </span>
                {label}
              </button>
            );
          })}
        </div>
        <TextArea label="Ghi chú (không bắt buộc)" rows={3} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} />
        <label className="flex items-start gap-3 text-sm">
          <input type="checkbox" checked={share} onChange={(e) => setShare(e.target.checked)} className="mt-0.5 size-4 accent-brand-600" />
          <span>Chia sẻ mục này với chuyên gia đang theo dõi tôi</span>
        </label>
        <Button onClick={add} loading={saving} disabled={!mood}>
          Lưu
        </Button>
      </Card>

      <h2 className="mb-3 text-lg font-semibold">Gần đây</h2>
      <QueryState loading={moods.loading} error={moods.error} />
      {moods.data &&
        (moods.data.entries.length === 0 ? (
          <Empty>Bạn chưa ghi mục nào.</Empty>
        ) : (
          <ul className="space-y-3">
            {moods.data.entries.map((m) => (
              <li key={m.id}>
                <Card className="space-y-2 !p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">
                      <span aria-hidden>{FACES[m.mood - 1]} </span>
                      {MOOD_LABELS[m.mood - 1]}
                    </p>
                    <span className="text-xs text-muted">{formatDateTime(m.createdAt)}</span>
                  </div>
                  {m.note && <p className="whitespace-pre-line text-sm text-muted">{m.note}</p>}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ShareToggle
                      shared={m.shared}
                      busy={busyId === m.id}
                      onToggle={() => void guard(m.id, () => api(`/mood/${m.id}/shared`, { method: 'PATCH', body: { shared: !m.shared } }), moods.reload)}
                    />
                    <button
                      type="button"
                      disabled={busyId === m.id}
                      onClick={() => {
                        if (window.confirm('Xóa mục này?')) void guard(m.id, () => api(`/mood/${m.id}`, { method: 'DELETE' }), moods.reload);
                      }}
                      className="text-sm font-semibold text-danger-600 hover:underline disabled:opacity-50"
                    >
                      Xóa
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ))}

      <div className="mb-3 mt-10 flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-semibold">Kết quả tự đánh giá đã lưu</h2>
        <LinkButton href="/tu-danh-gia" variant="secondary">
          Làm bài tự đánh giá
        </LinkButton>
      </div>
      <QueryState loading={results.loading} error={results.error} />
      {results.data &&
        (results.data.results.length === 0 ? (
          <Empty>
            Chưa có kết quả nào. Hãy thử{' '}
            <Link href="/tu-danh-gia" className="font-semibold text-brand-700 underline">
              bài tự đánh giá PHQ-9 / GAD-7
            </Link>
            .
          </Empty>
        ) : (
          <ul className="space-y-3">
            {results.data.results.map((r) => (
              <li key={r.id}>
                <Card className="space-y-2 !p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-semibold">{ASSESSMENTS[r.kind].title.split(':')[0]}</p>
                    <span className="text-xs text-muted">{formatDateTime(r.createdAt)}</span>
                  </div>
                  <p>
                    Điểm {r.score}/{ASSESSMENTS[r.kind].maxScore} · {r.label}
                  </p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <ShareToggle
                      shared={r.shared}
                      busy={busyId === r.id}
                      onToggle={() => void guard(r.id, () => api(`/assessments/${r.id}/shared`, { method: 'PATCH', body: { shared: !r.shared } }), results.reload)}
                    />
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => {
                        if (window.confirm('Xóa kết quả này?')) void guard(r.id, () => api(`/assessments/${r.id}`, { method: 'DELETE' }), results.reload);
                      }}
                      className="text-sm font-semibold text-danger-600 hover:underline disabled:opacity-50"
                    >
                      Xóa
                    </button>
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}

'use client';

import { ASSESSMENTS, type AssessmentResultDto, type HomeworkDto, MOOD_LABELS, type MoodEntryDto, type SessionNoteDto } from '@wtl/shared';
import { type FormEvent, useState } from 'react';
import { api, errorMessage } from '@/lib/api';
import { fieldErrors } from '@/lib/forms';
import { formatDate, formatDateTime } from '@/lib/format';
import { useQuery } from '@/lib/hooks';
import { Alert, Badge, Button, Card, Empty, QueryState, TextArea, TextField } from './ui';

const FACES = ['😞', '🙁', '😐', '🙂', '😄'];

// ---------- Bai tap: phia khach ----------

function HomeworkItem({ h, canSubmit, onSaved }: { h: HomeworkDto; canSubmit: boolean; onSaved: () => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/homework/${h.id}/submit`, { method: 'PATCH', body: { response: text } });
      onSaved();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-2 !p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="font-semibold">{h.title}</h4>
        {h.submittedAt ? <Badge tone="ok">Đã nộp</Badge> : <Badge tone="warm">Chưa nộp</Badge>}
      </div>
      {h.instructions && <p className="whitespace-pre-line text-sm text-muted">{h.instructions}</p>}
      <p className="text-xs text-muted">
        Giao ngày {formatDate(h.createdAt)}
        {h.dueDate && ` · Hạn ${formatDate(`${h.dueDate}T00:00:00+07:00`)}`}
      </p>
      {h.response && (
        <div className="rounded-2xl bg-brand-50 p-3 text-sm">
          <p className="mb-1 text-xs font-semibold text-muted">Bài làm{h.submittedAt && ` (${formatDateTime(h.submittedAt)})`}</p>
          <p className="whitespace-pre-line">{h.response}</p>
        </div>
      )}
      {canSubmit && !h.submittedAt && (
        <form onSubmit={submit} className="space-y-2">
          <TextArea label="Bài làm của bạn" rows={4} maxLength={4000} value={text} onChange={(e) => setText(e.target.value)} required />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" loading={busy} disabled={!text.trim()}>
            Nộp bài
          </Button>
        </form>
      )}
    </Card>
  );
}

export function HomeworkClientPanel({ caseId }: { caseId: string }) {
  const q = useQuery<{ homework: HomeworkDto[] }>(`/cases/${caseId}/homework`);
  return (
    <div className="space-y-3">
      <QueryState loading={q.loading} error={q.error} />
      {q.data &&
        (q.data.homework.length === 0 ? (
          <Empty>Chuyên gia chưa giao bài tập nào.</Empty>
        ) : (
          q.data.homework.map((h) => <HomeworkItem key={h.id} h={h} canSubmit onSaved={() => void q.reload()} />)
        ))}
    </div>
  );
}

// ---------- Bai tap: phia chuyen gia ----------

export function HomeworkExpertPanel({ caseId, canAssign }: { caseId: string; canAssign: boolean }) {
  const q = useQuery<{ homework: HomeworkDto[] }>(`/cases/${caseId}/homework`);
  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [errs, setErrs] = useState<Record<string, string>>({});

  const create = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setErrs({});
    try {
      await api(`/cases/${caseId}/homework`, { body: { title, instructions, ...(dueDate ? { dueDate } : {}) } });
      setTitle('');
      setInstructions('');
      setDueDate('');
      await q.reload();
    } catch (err) {
      setErrs(fieldErrors(err));
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {canAssign && (
        <Card>
          <form onSubmit={create} className="space-y-3" noValidate>
            <h3 className="font-semibold">Giao bài tập mới</h3>
            <TextField label="Tiêu đề" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} error={errs.title} required />
            <TextArea label="Hướng dẫn" rows={4} maxLength={2000} value={instructions} onChange={(e) => setInstructions(e.target.value)} error={errs.instructions} />
            <TextField label="Hạn nộp (không bắt buộc)" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} error={errs.dueDate} />
            {error && !Object.keys(errs).length && <Alert>{error}</Alert>}
            <Button type="submit" loading={busy}>
              Giao bài
            </Button>
          </form>
        </Card>
      )}
      <QueryState loading={q.loading} error={q.error} />
      {q.data &&
        (q.data.homework.length === 0 ? (
          <Empty>Chưa giao bài tập nào cho khách.</Empty>
        ) : (
          q.data.homework.map((h) => <HomeworkItem key={h.id} h={h} canSubmit={false} onSaved={() => void q.reload()} />)
        ))}
    </div>
  );
}

// ---------- Theo doi: chi hien muc khach da chu dong chia se ----------

export function ClientTrackingPanel({ caseId }: { caseId: string }) {
  const q = useQuery<{ mood: MoodEntryDto[]; assessments: AssessmentResultDto[] }>(`/cases/${caseId}/client-tracking`);
  return (
    <div className="space-y-4">
      <Alert tone="brand">Chỉ hiển thị những mục khách hàng đã chủ động chia sẻ. Mỗi lần xem đều được ghi nhật ký.</Alert>
      <QueryState loading={q.loading} error={q.error} />
      {q.data && (
        <>
          <section>
            <h3 className="mb-2 font-semibold">Nhật ký tâm trạng</h3>
            {q.data.mood.length === 0 ? (
              <Empty>Khách chưa chia sẻ mục nào.</Empty>
            ) : (
              <ul className="space-y-2">
                {q.data.mood.map((m) => (
                  <li key={m.id}>
                    <Card className="!p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">
                          <span aria-hidden>{FACES[m.mood - 1]} </span>
                          {MOOD_LABELS[m.mood - 1]}
                        </p>
                        <span className="text-xs text-muted">{formatDateTime(m.createdAt)}</span>
                      </div>
                      {m.note && <p className="mt-1 whitespace-pre-line text-sm text-muted">{m.note}</p>}
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
          <section>
            <h3 className="mb-2 font-semibold">Kết quả tự đánh giá</h3>
            {q.data.assessments.length === 0 ? (
              <Empty>Khách chưa chia sẻ kết quả nào.</Empty>
            ) : (
              <ul className="space-y-2">
                {q.data.assessments.map((r) => (
                  <li key={r.id}>
                    <Card className="!p-4">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-semibold">{ASSESSMENTS[r.kind].title.split(':')[0]}</p>
                        <span className="text-xs text-muted">{formatDateTime(r.createdAt)}</span>
                      </div>
                      <p className="text-sm">
                        Điểm {r.score}/{ASSESSMENTS[r.kind].maxScore} · {r.label} {r.urgent && <Badge tone="danger">Cần lưu ý</Badge>}
                      </p>
                    </Card>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </div>
  );
}

// ---------- Ghi chu buoi (rieng tu cua chuyen gia) ----------

function NoteItem({ n, onChanged }: { n: SessionNoteDto; onChanged: () => void }) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(n.body);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setEditing(false);
      onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card className="space-y-2 !p-4">
      <p className="text-xs text-muted">
        {formatDateTime(n.createdAt)}
        {n.updatedAt !== n.createdAt && ` · sửa ${formatDateTime(n.updatedAt)}`}
      </p>
      {editing ? (
        <>
          <TextArea label="Nội dung ghi chú" rows={5} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} />
          <div className="flex gap-2">
            <Button loading={busy} disabled={!text.trim()} onClick={() => void run(() => api(`/notes/${n.id}`, { method: 'PATCH', body: { body: text } }))}>
              Lưu
            </Button>
            <Button
              variant="ghost"
              onClick={() => {
                setText(n.body);
                setEditing(false);
              }}
            >
              Hủy
            </Button>
          </div>
        </>
      ) : (
        <>
          <p className="whitespace-pre-line">{n.body}</p>
          <div className="flex gap-4 text-sm font-semibold">
            <button type="button" className="text-brand-700 hover:underline" onClick={() => setEditing(true)}>
              Sửa
            </button>
            <button
              type="button"
              disabled={busy}
              className="text-danger-600 hover:underline disabled:opacity-50"
              onClick={() => {
                if (window.confirm('Xóa ghi chú này?')) void run(() => api(`/notes/${n.id}`, { method: 'DELETE' }));
              }}
            >
              Xóa
            </button>
          </div>
        </>
      )}
      {error && <Alert>{error}</Alert>}
    </Card>
  );
}

export function SessionNotesPanel({ caseId }: { caseId: string }) {
  const q = useQuery<{ notes: SessionNoteDto[] }>(`/cases/${caseId}/notes`);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const add = async (e: FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await api(`/cases/${caseId}/notes`, { body: { body: text } });
      setText('');
      await q.reload();
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <Alert tone="brand">Ghi chú này là riêng tư: chỉ bạn xem được. Khách hàng và quản trị viên không thấy nội dung.</Alert>
      <Card>
        <form onSubmit={add} className="space-y-3">
          <TextArea label="Ghi chú mới" rows={4} maxLength={5000} value={text} onChange={(e) => setText(e.target.value)} />
          {error && <Alert>{error}</Alert>}
          <Button type="submit" loading={busy} disabled={!text.trim()}>
            Lưu ghi chú
          </Button>
        </form>
      </Card>
      <QueryState loading={q.loading} error={q.error} />
      {q.data &&
        (q.data.notes.length === 0 ? <Empty>Chưa có ghi chú nào.</Empty> : q.data.notes.map((n) => <NoteItem key={n.id} n={n} onChanged={() => void q.reload()} />))}
    </div>
  );
}

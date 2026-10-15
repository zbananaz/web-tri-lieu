'use client';

import type { AnswerSnapshot, CaseStatus, RiskLevel } from '@wtl/shared';
import { CHAT_OPEN_STATUSES, RISK_LABELS } from '@wtl/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { useState } from 'react';
import { type Appointment, AppointmentList } from '@/components/Appointments';
import { Chat } from '@/components/Chat';
import { StatusBadge, Tabs, Timeline } from '@/components/case';
import { Alert, Badge, Button, Card, PageTitle, QueryState, SelectField, TextArea } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDate, MODE_LABELS, riskTone } from '@/lib/format';
import { useQuery } from '@/lib/hooks';

interface Suggestion {
  expertId: string;
  fullName: string;
  headline: string;
  score: number;
  reasons: string[];
}
interface Detail {
  id: string;
  status: CaseStatus;
  riskLevel: RiskLevel;
  createdAt: string;
  concerns: string;
  preferredMode: string | null;
  answers: AnswerSnapshot[];
  client: { id: string; fullName: string; email: string; phone: string | null };
  events: { toStatus: CaseStatus; createdAt: string; note: string | null }[];
  adminNote: string | null;
  rejectionReason: string | null;
  assignedExpertId: string | null;
  suggestions: Suggestion[];
}
interface AdminExpert {
  id: string;
  fullName: string;
  active: boolean;
}

function AdminActions({ c, onDone }: { c: Detail; onDone: () => void }) {
  const experts = useQuery<{ experts: AdminExpert[] }>(c.status === 'approved' || c.status === 'assigned' ? '/admin/experts' : null);
  const [expertId, setExpertId] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const go = async (key: string, body: Record<string, unknown>, confirm?: string) => {
    if (confirm && !window.confirm(confirm)) return;
    setBusy(key);
    setError(null);
    try {
      await api(`/cases/${c.id}/transition`, { body });
      setNote('');
      onDone();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  if (c.status === 'rejected' || c.status === 'closed') return null;
  const activeExperts = experts.data?.experts.filter((e) => e.active) ?? [];
  const chosen = expertId || c.suggestions[0]?.expertId || '';

  return (
    <Card className="space-y-4">
      <h3 className="font-semibold">Xử lý hồ sơ</h3>
      {error && <Alert>{error}</Alert>}

      {c.status === 'submitted' && (
        <>
          <TextArea label="Lý do (bắt buộc nếu từ chối; khách sẽ thấy)" rows={2} maxLength={1000} value={note} onChange={(e) => setNote(e.target.value)} />
          <div className="flex flex-wrap gap-2">
            <Button loading={busy === 'approved'} onClick={() => go('approved', { to: 'approved', ...(note.trim() ? { note: note.trim() } : {}) })}>
              Duyệt hồ sơ
            </Button>
            <Button variant="danger" loading={busy === 'rejected'} disabled={!note.trim()} onClick={() => go('rejected', { to: 'rejected', note: note.trim() }, 'Từ chối hồ sơ này?')}>
              Từ chối
            </Button>
          </div>
        </>
      )}

      {(c.status === 'approved' || c.status === 'assigned') && (
        <>
          {c.suggestions.length > 0 && (
            <div>
              <p className="mb-2 text-sm font-semibold">Gợi ý chuyên gia</p>
              <ul className="space-y-2">
                {c.suggestions.map((s) => (
                  <li key={s.expertId}>
                    <label className={`flex min-h-11 cursor-pointer items-start gap-3 rounded-2xl border p-3 ${chosen === s.expertId ? 'border-brand-600 bg-brand-50' : 'border-line'}`}>
                      <input type="radio" name="expert" className="mt-1 size-4 accent-brand-600" checked={chosen === s.expertId} onChange={() => setExpertId(s.expertId)} />
                      <span>
                        <span className="font-semibold">{s.fullName}</span> <span className="text-sm text-muted">· điểm {s.score}</span>
                        <span className="block text-sm text-muted">{s.reasons.join(' · ') || s.headline}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <SelectField label="Hoặc chọn chuyên gia khác" value={expertId} onChange={(e) => setExpertId(e.target.value)}>
            <option value="">— Dùng gợi ý ở trên —</option>
            {activeExperts.map((e) => (
              <option key={e.id} value={e.id}>
                {e.fullName}
              </option>
            ))}
          </SelectField>
          <Button loading={busy === 'assigned'} disabled={!chosen} onClick={() => go('assigned', { to: 'assigned', expertId: chosen })}>
            {c.status === 'assigned' ? 'Đổi chuyên gia' : 'Phân cho chuyên gia'}
          </Button>
        </>
      )}

      <div className="flex flex-wrap items-end gap-2 border-t border-line pt-4">
        {c.status === 'assigned' && (
          <div className="w-full space-y-2">
            <TextArea label="Lý do thu hồi phân công" rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            <Button variant="secondary" disabled={!note.trim()} loading={busy === 'revoke'} onClick={() => go('revoke', { to: 'approved', note: note.trim() }, 'Thu hồi phân công và đưa hồ sơ về hàng chờ?')}>
              Thu hồi phân công
            </Button>
          </div>
        )}
        <Button variant="ghost" loading={busy === 'closed'} onClick={() => go('closed', { to: 'closed', ...(note.trim() ? { note: note.trim() } : {}) }, 'Đóng hồ sơ này?')}>
          Đóng hồ sơ
        </Button>
      </div>
    </Card>
  );
}

function AdminNote({ c, onSaved }: { c: Detail; onSaved: () => void }) {
  const [text, setText] = useState(c.adminNote ?? '');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const save = async () => {
    setBusy(true);
    setMsg(null);
    try {
      await api(`/admin/cases/${c.id}/note`, { body: { note: text } });
      setMsg({ ok: true, text: 'Đã lưu ghi chú.' });
      onSaved();
    } catch (e) {
      setMsg({ ok: false, text: errorMessage(e) });
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="space-y-3">
      <h3 className="font-semibold">Ghi chú nội bộ</h3>
      <TextArea label="Chỉ quản trị viên thấy" value={text} maxLength={2000} onChange={(e) => setText(e.target.value)} />
      {msg && <Alert tone={msg.ok ? 'ok' : 'danger'}>{msg.text}</Alert>}
      <Button variant="secondary" onClick={save} loading={busy}>
        Lưu ghi chú
      </Button>
    </Card>
  );
}

export default function AdminCasePage() {
  const { id } = useParams<{ id: string }>();
  const detail = useQuery<Detail>(`/cases/${id}`);
  const appts = useQuery<{ appointments: Appointment[] }>(`/cases/${id}/appointments`);

  if (detail.loading || detail.error || !detail.data) return <QueryState loading={detail.loading} error={detail.error} />;
  const c = detail.data;
  const chat = CHAT_OPEN_STATUSES.includes(c.status) || c.status === 'closed';

  const overview = (
    <div className="space-y-4">
      {c.riskLevel === 'urgent' && <Alert>Hồ sơ KHẨN CẤP: khách đã chọn đáp án nguy cơ cao. Liên hệ ngay theo quy trình an toàn.</Alert>}
      {c.rejectionReason && <Alert tone="warm">Lý do từ chối: {c.rejectionReason}</Alert>}
      <AdminActions c={c} onDone={() => void detail.reload()} />
      <Card>
        <h3 className="mb-3 font-semibold">Khách hàng</h3>
        <dl className="grid gap-3 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted">Họ tên</dt>
            <dd className="font-medium">{c.client.fullName}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Email</dt>
            <dd className="break-all font-medium">{c.client.email}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Điện thoại</dt>
            <dd className="font-medium">{c.client.phone ?? '—'}</dd>
          </div>
        </dl>
        <p className="mt-3 text-xs text-muted">Mỗi lần xem hồ sơ đều được ghi nhật ký kiểm toán.</p>
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">Câu trả lời sàng lọc</h3>
        <dl className="space-y-3">
          {c.answers.map((a) => (
            <div key={a.questionId}>
              <dt className="text-sm text-muted">{a.prompt}</dt>
              <dd className="flex flex-wrap items-center gap-2 font-medium">
                {[...a.labels, a.text].filter(Boolean).join(', ') || '—'}
                {a.risk && <Badge tone={a.risk === 'urgent' ? 'danger' : 'warm'}>{a.risk === 'urgent' ? 'Nguy cơ cao' : 'Cần lưu ý'}</Badge>}
              </dd>
            </div>
          ))}
        </dl>
        {c.concerns && <p className="mt-3 text-sm">Khách chia sẻ thêm: {c.concerns}</p>}
        {c.preferredMode && <p className="mt-1 text-sm text-muted">Hình thức mong muốn: {MODE_LABELS[c.preferredMode] ?? c.preferredMode}</p>}
      </Card>
      <AdminNote c={c} onSaved={() => void detail.reload()} />
      <Card>
        <h3 className="mb-3 font-semibold">Tiến trình</h3>
        <Timeline events={c.events} />
      </Card>
    </div>
  );

  const tabs: { id: string; label: string; content: React.ReactNode }[] = [{ id: 'overview', label: 'Tổng quan', content: overview }];
  if (chat) {
    tabs.push({
      id: 'appointments',
      label: 'Lịch hẹn',
      content: (
        <>
          <QueryState loading={appts.loading} error={appts.error} />
          {appts.data && <AppointmentList items={appts.data.appointments} role="admin" onChanged={() => void appts.reload()} />}
        </>
      ),
    });
    tabs.push({
      id: 'chat',
      label: 'Trò chuyện (chỉ xem)',
      content: (
        <div className="space-y-3">
          <Alert tone="warm">Việc xem nội dung trò chuyện được ghi vào nhật ký kiểm toán. Chỉ xem khi thật sự cần thiết.</Alert>
          <Chat caseId={c.id} canSend={false} />
        </div>
      ),
    });
  }

  return (
    <>
      <Link href="/admin" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Hàng chờ
      </Link>
      <div className="mt-3">
        <PageTitle title={c.client.fullName}>
          <div className="flex items-center gap-2">
            {c.riskLevel !== 'none' && <Badge tone={riskTone(c.riskLevel)}>{RISK_LABELS[c.riskLevel]}</Badge>}
            <StatusBadge status={c.status} />
          </div>
        </PageTitle>
        <p className="mb-4 text-sm text-muted">Gửi ngày {formatDate(c.createdAt)}</p>
      </div>
      <Tabs tabs={tabs} />
    </>
  );
}

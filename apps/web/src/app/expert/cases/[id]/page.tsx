'use client';

import type { AnswerSnapshot, CaseStatus, RiskLevel } from '@wtl/shared';
import { CHAT_OPEN_STATUSES, RISK_LABELS } from '@wtl/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type Appointment, AppointmentList } from '@/components/Appointments';
import { Chat } from '@/components/Chat';
import { AnswersView, StatusBadge, Tabs, Timeline } from '@/components/case';
import { TransitionPanel } from '@/components/Transitions';
import { Alert, Badge, Card, PageTitle, QueryState } from '@/components/ui';
import { formatDate, MODE_LABELS, riskTone } from '@/lib/format';
import { useQuery } from '@/lib/hooks';

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
}

export default function ExpertCasePage() {
  const { id } = useParams<{ id: string }>();
  const detail = useQuery<Detail>(`/cases/${id}`);
  const appts = useQuery<{ appointments: Appointment[] }>(`/cases/${id}/appointments`);
  const unread = useQuery<{ byCase: Record<string, number> }>('/messages/unread');

  if (detail.loading || detail.error || !detail.data) return <QueryState loading={detail.loading} error={detail.error} />;
  const c = detail.data;
  const chatOpen = CHAT_OPEN_STATUSES.includes(c.status);

  const overview = (
    <div className="space-y-4">
      {c.riskLevel !== 'none' && (
        <Alert tone={c.riskLevel === 'urgent' ? 'danger' : 'warm'}>
          Mức nguy cơ: <strong>{RISK_LABELS[c.riskLevel]}</strong>. Vui lòng liên hệ khách sớm và theo quy trình an toàn của trung tâm.
        </Alert>
      )}
      <Card>
        <h3 className="mb-3 font-bold">Thông tin liên hệ</h3>
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
        <p className="mt-3 text-xs text-muted">Mỗi lần xem thông tin này đều được ghi nhật ký.</p>
      </Card>
      <Card>
        <h3 className="mb-3 font-bold">Câu trả lời sàng lọc</h3>
        <AnswersView answers={c.answers} />
        {c.concerns && <p className="mt-3 text-sm">Khách chia sẻ thêm: {c.concerns}</p>}
        {c.preferredMode && <p className="mt-1 text-sm text-muted">Hình thức mong muốn: {MODE_LABELS[c.preferredMode] ?? c.preferredMode}</p>}
      </Card>
      <Card>
        <h3 className="mb-3 font-bold">Tiến trình</h3>
        <Timeline events={c.events} />
      </Card>
      <TransitionPanel caseId={c.id} status={c.status} role="expert" onDone={() => void detail.reload()} />
    </div>
  );

  const tabs = [{ id: 'overview', label: 'Tổng quan', badge: undefined as number | undefined, content: overview }];
  if (chatOpen || c.status === 'closed') {
    tabs.push({
      id: 'appointments',
      label: 'Lịch hẹn',
      badge: undefined,
      content: (
        <>
          <QueryState loading={appts.loading} error={appts.error} />
          {appts.data && <AppointmentList items={appts.data.appointments} role="expert" onChanged={() => void appts.reload()} />}
        </>
      ),
    });
    tabs.push({ id: 'chat', label: 'Trò chuyện', badge: unread.data?.byCase[c.id], content: <Chat caseId={c.id} canSend={chatOpen} peerName={c.client.fullName} /> });
  }

  return (
    <>
      <Link href="/expert" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Ca của tôi
      </Link>
      <div className="mt-3">
        <PageTitle title={c.client.fullName}>
          <div className="flex items-center gap-2">
            {c.riskLevel !== 'none' && <Badge tone={riskTone(c.riskLevel)}>{RISK_LABELS[c.riskLevel]}</Badge>}
            <StatusBadge status={c.status} />
          </div>
        </PageTitle>
        <p className="mb-4 text-sm text-muted">Hồ sơ ngày {formatDate(c.createdAt)}</p>
      </div>
      <Tabs tabs={tabs} />
    </>
  );
}

'use client';

import type { CaseStatus, PublicExpert, RiskLevel } from '@wtl/shared';
import { CHAT_OPEN_STATUSES } from '@wtl/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { type Appointment, AppointmentList, BookingPanel } from '@/components/Appointments';
import { Chat } from '@/components/Chat';
import { HomeworkClientPanel } from '@/components/CarePanels';
import { AnswersView, ExpertSummary, type Hotline, HotlineAlert, StatusBadge, Tabs, Timeline } from '@/components/case';
import { Alert, Card, PageTitle, QueryState } from '@/components/ui';
import { formatDate, MODE_LABELS } from '@/lib/format';
import { useQuery } from '@/lib/hooks';

interface Detail {
  id: string;
  status: CaseStatus;
  riskLevel: RiskLevel;
  createdAt: string;
  concerns: string;
  preferredMode: string | null;
  rejectionReason: string | null;
  answers: { prompt: string; labels: string[]; text?: string }[];
  expert: PublicExpert | null;
  events: { toStatus: CaseStatus; createdAt: string }[];
  hotlines: Hotline[];
}

export default function MyCasePage() {
  const { id } = useParams<{ id: string }>();
  const detail = useQuery<Detail>(`/cases/${id}`);
  const appts = useQuery<{ appointments: Appointment[] }>(`/cases/${id}/appointments`);
  const unread = useQuery<{ byCase: Record<string, number> }>('/messages/unread');

  if (detail.loading || detail.error || !detail.data) return <QueryState loading={detail.loading} error={detail.error} />;
  const c = detail.data;
  const canChat = CHAT_OPEN_STATUSES.includes(c.status) && !!c.expert;

  const overview = (
    <div className="space-y-4">
      {c.status === 'rejected' && <Alert tone="warm">{c.rejectionReason || 'Hồ sơ của bạn chưa phù hợp với dịch vụ hiện tại. Bạn có thể liên hệ để được tư vấn thêm.'}</Alert>}
      {c.status === 'submitted' && <Alert tone="brand">Hồ sơ đang chờ được xem xét. Chúng tôi sẽ cập nhật tại đây.</Alert>}
      {c.status === 'approved' && <Alert tone="brand">Hồ sơ đã được duyệt. Chúng tôi đang chọn chuyên gia phù hợp cho bạn.</Alert>}
      <Card>
        <h3 className="mb-3 font-semibold">Tiến trình</h3>
        <Timeline events={c.events} />
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">Câu trả lời của bạn</h3>
        <AnswersView answers={c.answers} />
        {c.concerns && <p className="mt-3 text-sm text-muted">Chia sẻ thêm: {c.concerns}</p>}
        {c.preferredMode && <p className="mt-1 text-sm text-muted">Hình thức mong muốn: {MODE_LABELS[c.preferredMode] ?? c.preferredMode}</p>}
      </Card>
    </div>
  );

  const tabs = [{ id: 'overview', label: 'Tổng quan', content: overview }];
  if (canChat) {
    tabs.push({
      id: 'appointments',
      label: 'Lịch hẹn',
      content: (
        <div className="space-y-4">
          <BookingPanel caseId={c.id} onBooked={() => void appts.reload()} />
          <h3 className="text-lg font-semibold">Lịch hẹn của bạn</h3>
          <QueryState loading={appts.loading} error={appts.error} />
          {appts.data && <AppointmentList items={appts.data.appointments} role="client" onChanged={() => void appts.reload()} />}
        </div>
      ),
    });
    tabs.push({ id: 'homework', label: 'Bài tập', content: <HomeworkClientPanel caseId={c.id} /> });
    tabs.push({
      id: 'chat',
      label: 'Trò chuyện',
      content: <Chat caseId={c.id} canSend peerName={c.expert?.fullName} />,
    });
  }

  return (
    <>
      <Link href="/me" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Hồ sơ của tôi
      </Link>
      <div className="mt-3">
        <PageTitle title={`Hồ sơ ngày ${formatDate(c.createdAt)}`}>
          <StatusBadge status={c.status} />
        </PageTitle>
      </div>
      <div className="space-y-4">
        <HotlineAlert hotlines={c.hotlines} />
        {c.expert && <ExpertSummary expert={c.expert} />}
        <Tabs
          tabs={tabs.map((t) => (t.id === 'chat' ? { ...t, badge: unread.data?.byCase[c.id] } : t))}
        />
      </div>
    </>
  );
}

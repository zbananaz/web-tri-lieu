'use client';

import type { CaseStatus, RiskLevel } from '@wtl/shared';
import { RISK_LABELS } from '@wtl/shared';
import Link from 'next/link';
import { StatusBadge } from '@/components/case';
import { Badge, Card, Empty, PageTitle, QueryState } from '@/components/ui';
import { formatDate, riskTone } from '@/lib/format';
import { useQuery } from '@/lib/hooks';

interface Row {
  id: string;
  status: CaseStatus;
  riskLevel: RiskLevel;
  assignedAt: string | null;
  clientName: string;
}

export default function ExpertCasesPage() {
  const q = useQuery<{ cases: Row[] }>('/expert/cases');
  const unread = useQuery<{ byCase: Record<string, number> }>('/messages/unread');
  return (
    <>
      <PageTitle title="Ca của tôi" />
      <QueryState loading={q.loading} error={q.error} />
      {q.data && q.data.cases.length === 0 && <Empty>Bạn chưa được phân ca nào.</Empty>}
      <ul className="space-y-3">
        {q.data?.cases.map((c) => {
          const n = unread.data?.byCase[c.id];
          return (
            <li key={c.id}>
              <Link href={`/expert/cases/${c.id}`} className="block">
                <Card className="flex flex-wrap items-center justify-between gap-3 transition hover:shadow-md">
                  <div>
                    <p className="font-semibold">{c.clientName}</p>
                    <p className="text-sm text-muted">{c.assignedAt ? `Phân ngày ${formatDate(c.assignedAt)}` : ''}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {c.riskLevel !== 'none' && <Badge tone={riskTone(c.riskLevel)}>{RISK_LABELS[c.riskLevel]}</Badge>}
                    {!!n && <Badge tone="danger">{n} tin mới</Badge>}
                    <StatusBadge status={c.status} />
                  </div>
                </Card>
              </Link>
            </li>
          );
        })}
      </ul>
    </>
  );
}

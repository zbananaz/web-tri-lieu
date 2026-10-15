'use client';

import type { CaseStatus, RiskLevel } from '@wtl/shared';
import { CASE_STATUS_LABELS, CASE_STATUSES, RISK_LABELS, RISK_LEVELS } from '@wtl/shared';
import Link from 'next/link';
import { useState } from 'react';
import { StatusBadge } from '@/components/case';
import { Badge, Card, Empty, PageTitle, QueryState, SelectField } from '@/components/ui';
import { formatDateTime, riskTone } from '@/lib/format';
import { useQuery } from '@/lib/hooks';

interface Row {
  id: string;
  status: CaseStatus;
  riskLevel: RiskLevel;
  createdAt: string;
  clientName: string;
  assignedExpertId: string | null;
}

export default function AdminQueuePage() {
  const [status, setStatus] = useState('');
  const [risk, setRisk] = useState('');
  const qs = new URLSearchParams();
  if (status) qs.set('status', status);
  if (risk) qs.set('riskLevel', risk);
  const q = useQuery<{ cases: Row[] }>(`/admin/cases${qs.size ? `?${qs}` : ''}`);
  const urgent = q.data?.cases.filter((c) => c.riskLevel === 'urgent' && c.status !== 'closed' && c.status !== 'rejected').length ?? 0;

  return (
    <>
      <PageTitle title="Hàng chờ hồ sơ" />
      {urgent > 0 && (
        <div role="alert" className="mb-4 rounded-xl bg-danger-50 px-4 py-3 font-semibold text-danger-600">
          Có {urgent} hồ sơ khẩn cấp đang mở — xử lý trước.
        </div>
      )}
      <div className="mb-4 grid gap-3 sm:grid-cols-2">
        <SelectField label="Trạng thái" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">Tất cả</option>
          {CASE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {CASE_STATUS_LABELS[s]}
            </option>
          ))}
        </SelectField>
        <SelectField label="Mức nguy cơ" value={risk} onChange={(e) => setRisk(e.target.value)}>
          <option value="">Tất cả</option>
          {RISK_LEVELS.map((r) => (
            <option key={r} value={r}>
              {RISK_LABELS[r]}
            </option>
          ))}
        </SelectField>
      </div>
      <QueryState loading={q.loading} error={q.error} />
      {q.data && q.data.cases.length === 0 && <Empty>Không có hồ sơ phù hợp.</Empty>}
      <ul className="space-y-3">
        {q.data?.cases.map((c) => (
          <li key={c.id}>
            <Link href={`/admin/cases/${c.id}`} className="block">
              <Card className={`flex flex-wrap items-center justify-between gap-3 transition hover:shadow-md ${c.riskLevel === 'urgent' ? 'border-danger-600' : ''}`}>
                <div>
                  <p className="font-semibold">{c.clientName}</p>
                  <p className="text-sm text-muted">Gửi lúc {formatDateTime(c.createdAt)}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {c.riskLevel !== 'none' && <Badge tone={riskTone(c.riskLevel)}>{RISK_LABELS[c.riskLevel]}</Badge>}
                  <StatusBadge status={c.status} />
                </div>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

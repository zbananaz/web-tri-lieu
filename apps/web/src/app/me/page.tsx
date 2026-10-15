'use client';

import type { CaseStatus, PublicExpert, RiskLevel } from '@wtl/shared';
import { OPEN_CASE_STATUSES } from '@wtl/shared';
import Link from 'next/link';
import { StatusBadge } from '@/components/case';
import { Card, Empty, LinkButton, PageTitle, QueryState } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { useQuery } from '@/lib/hooks';

interface MyCase {
  id: string;
  status: CaseStatus;
  riskLevel: RiskLevel;
  createdAt: string;
  rejectionReason: string | null;
  expert: Pick<PublicExpert, 'id' | 'fullName' | 'headline' | 'avatarUrl'> | null;
}

export default function MyCasesPage() {
  const { data, loading, error } = useQuery<{ cases: MyCase[] }>('/cases/mine');
  const cases = data?.cases ?? [];
  const hasOpen = cases.some((c) => OPEN_CASE_STATUSES.includes(c.status));

  return (
    <>
      <PageTitle title="Hồ sơ của tôi">{!hasOpen && !loading && <LinkButton href="/screening">Làm sàng lọc mới</LinkButton>}</PageTitle>
      <QueryState loading={loading} error={error} />
      {data && cases.length === 0 && (
        <Empty>
          <p>Bạn chưa gửi hồ sơ sàng lọc nào.</p>
          <LinkButton href="/screening" className="mt-4">
            Bắt đầu sàng lọc
          </LinkButton>
        </Empty>
      )}
      <ul className="space-y-3">
        {cases.map((c) => (
          <li key={c.id}>
            <Link href={`/me/cases/${c.id}`} className="block">
              <Card className="flex flex-wrap items-center justify-between gap-3 transition hover:shadow-md">
                <div>
                  <p className="font-semibold">Hồ sơ ngày {formatDate(c.createdAt)}</p>
                  <p className="text-sm text-muted">{c.expert ? `Chuyên gia: ${c.expert.fullName}` : 'Chưa phân chuyên gia'}</p>
                </div>
                <StatusBadge status={c.status} />
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

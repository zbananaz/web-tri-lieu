'use client';

import { PageTitle, QueryState } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { useQuery } from '@/lib/hooks';

interface Log {
  id: number;
  action: string;
  entity: string;
  entityId: string | null;
  ip: string | null;
  createdAt: string;
  actorName: string | null;
  actorEmail: string | null;
}

export default function AuditPage() {
  const q = useQuery<{ logs: Log[] }>('/admin/audit-logs?limit=200');
  return (
    <>
      <PageTitle title="Nhật ký kiểm toán" />
      <p className="mb-4 text-sm text-muted">200 hoạt động gần nhất. Nội dung tin nhắn và mật khẩu không bao giờ được ghi vào nhật ký.</p>
      <QueryState loading={q.loading} error={q.error} />
      {q.data && (
        <div className="overflow-x-auto rounded-2xl border border-line bg-surface">
          <table className="w-full min-w-[44rem] text-left text-sm">
            <thead className="border-b border-line bg-brand-50 text-muted">
              <tr>
                <th className="px-4 py-3 font-semibold">Thời gian</th>
                <th className="px-4 py-3 font-semibold">Người thực hiện</th>
                <th className="px-4 py-3 font-semibold">Hành động</th>
                <th className="px-4 py-3 font-semibold">Đối tượng</th>
                <th className="px-4 py-3 font-semibold">IP</th>
              </tr>
            </thead>
            <tbody>
              {q.data.logs.map((l) => (
                <tr key={l.id} className="border-b border-line last:border-0">
                  <td className="whitespace-nowrap px-4 py-2.5">{formatDateTime(l.createdAt)}</td>
                  <td className="px-4 py-2.5">{l.actorName ?? <span className="text-muted">Hệ thống / ẩn danh</span>}</td>
                  <td className="px-4 py-2.5 font-mono text-xs">{l.action}</td>
                  <td className="px-4 py-2.5 text-xs text-muted">
                    {l.entity}
                    {l.entityId ? ` · ${l.entityId.slice(0, 8)}` : ''}
                  </td>
                  <td className="px-4 py-2.5 text-xs text-muted">{l.ip ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

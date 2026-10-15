'use client';

import type { ReviewStatus } from '@wtl/shared';
import { useState } from 'react';
import { Stars } from '@/components/cards';
import { Alert, Badge, Button, Card, Empty, PageTitle, QueryState } from '@/components/ui';
import { api, errorMessage } from '@/lib/api';
import { formatDateTime } from '@/lib/format';
import { useQuery } from '@/lib/hooks';

interface AdminReview {
  id: string;
  rating: number;
  comment: string;
  status: ReviewStatus;
  createdAt: string;
  clientName: string;
  expertName: string;
}

const TABS: { status: ReviewStatus; label: string }[] = [
  { status: 'pending', label: 'Chờ duyệt' },
  { status: 'published', label: 'Đã đăng' },
  { status: 'hidden', label: 'Đã ẩn' },
];
const TONE = { pending: 'warm', published: 'ok', hidden: 'neutral' } as const;

export default function AdminReviewsPage() {
  const [status, setStatus] = useState<ReviewStatus>('pending');
  const q = useQuery<{ reviews: AdminReview[] }>(`/admin/reviews?status=${status}`);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const moderate = async (id: string, to: 'published' | 'hidden') => {
    setBusy(id);
    setError(null);
    try {
      await api(`/admin/reviews/${id}`, { method: 'PATCH', body: { status: to } });
      await q.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <>
      <PageTitle title="Duyệt đánh giá" />
      <p className="mb-4 text-sm text-muted">Đánh giá chỉ hiện công khai sau khi được duyệt, và luôn ẩn tên khách hàng.</p>
      <div role="tablist" aria-label="Trạng thái đánh giá" className="mb-4 flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button
            key={t.status}
            role="tab"
            type="button"
            aria-selected={status === t.status}
            onClick={() => setStatus(t.status)}
            className={`min-h-11 rounded-full border px-4 text-sm font-semibold ${status === t.status ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface hover:bg-brand-50'}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {error && (
        <div className="mb-3">
          <Alert>{error}</Alert>
        </div>
      )}
      <QueryState loading={q.loading} error={q.error} />
      {q.data &&
        (q.data.reviews.length === 0 ? (
          <Empty>Không có đánh giá nào ở mục này.</Empty>
        ) : (
          <ul className="space-y-3">
            {q.data.reviews.map((r) => (
              <li key={r.id}>
                <Card className="space-y-2 !p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Stars value={r.rating} />
                      <span className="text-sm font-semibold">{r.rating}/5</span>
                      <Badge tone={TONE[r.status]}>{TABS.find((t) => t.status === r.status)?.label}</Badge>
                    </span>
                    <span className="text-xs text-muted">{formatDateTime(r.createdAt)}</span>
                  </div>
                  <p className="text-sm text-muted">
                    {r.clientName} → chuyên gia {r.expertName}
                  </p>
                  {r.comment ? <p className="whitespace-pre-line">{r.comment}</p> : <p className="text-sm italic text-muted">Không có nhận xét</p>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    {r.status !== 'published' && (
                      <Button loading={busy === r.id} onClick={() => moderate(r.id, 'published')}>
                        Đăng công khai
                      </Button>
                    )}
                    {r.status !== 'hidden' && (
                      <Button variant="secondary" loading={busy === r.id} onClick={() => moderate(r.id, 'hidden')}>
                        Ẩn
                      </Button>
                    )}
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        ))}
    </>
  );
}

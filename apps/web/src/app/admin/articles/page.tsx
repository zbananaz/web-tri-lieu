'use client';

import type { ArticleSummary } from '@wtl/shared';
import Link from 'next/link';
import { Badge, Card, Empty, LinkButton, PageTitle, QueryState } from '@/components/ui';
import { formatDateTime } from '@/lib/format';
import { useQuery } from '@/lib/hooks';

export default function AdminArticlesPage() {
  const q = useQuery<{ articles: ArticleSummary[] }>('/admin/articles');
  return (
    <>
      <PageTitle title="Bài viết">
        <LinkButton href="/admin/articles/new">+ Viết bài mới</LinkButton>
      </PageTitle>
      <QueryState loading={q.loading} error={q.error} />
      {q.data && q.data.articles.length === 0 && <Empty>Chưa có bài viết.</Empty>}
      <ul className="space-y-3">
        {q.data?.articles.map((a) => (
          <li key={a.id}>
            <Link href={`/admin/articles/${a.id}`} className="block">
              <Card className="flex flex-wrap items-center justify-between gap-3 transition hover:shadow-md">
                <div className="min-w-0">
                  <p className="truncate font-semibold">{a.title}</p>
                  <p className="text-sm text-muted">
                    {a.authorName}
                    {a.publishedAt ? ` · xuất bản ${formatDateTime(a.publishedAt)}` : ''}
                  </p>
                </div>
                <Badge tone={a.status === 'published' ? 'ok' : 'warm'}>{a.status === 'published' ? 'Đã xuất bản' : 'Bản nháp'}</Badge>
              </Card>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}

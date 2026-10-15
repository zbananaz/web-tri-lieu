'use client';

import type { ArticleDetail } from '@wtl/shared';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArticleEditor } from '@/components/ArticleEditor';
import { PageTitle, QueryState } from '@/components/ui';
import { useQuery } from '@/lib/hooks';

export default function EditArticlePage() {
  const { id } = useParams<{ id: string }>();
  const q = useQuery<{ article: ArticleDetail }>(`/admin/articles/${id}`);
  return (
    <>
      <Link href="/admin/articles" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Tất cả bài viết
      </Link>
      <div className="mt-3">
        <PageTitle title="Chỉnh sửa bài viết" />
      </div>
      <QueryState loading={q.loading} error={q.error} />
      {q.data && <ArticleEditor article={q.data.article} />}
    </>
  );
}

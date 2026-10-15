import type { ArticleSummary } from '@wtl/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArticleCard } from '@/components/cards';
import { Empty, PageTitle } from '@/components/ui';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'Bài viết',
  description: 'Kiến thức và chia sẻ về sức khỏe tinh thần từ đội ngũ chuyên gia.',
  alternates: { canonical: '/articles' },
};

const PAGE_SIZE = 9;

export default async function ArticlesPage({ searchParams }: PageProps<'/articles'>) {
  const sp = await searchParams;
  const page = Math.max(1, Math.min(1000, Number(typeof sp.page === 'string' ? sp.page : 1) || 1));
  const tag = typeof sp.tag === 'string' && sp.tag.length <= 30 ? sp.tag : undefined;
  const qs = new URLSearchParams({ page: String(page), pageSize: String(PAGE_SIZE) });
  if (tag) qs.set('tag', tag);
  const data = await serverApi<{ articles: ArticleSummary[]; total: number }>(`/articles?${qs}`);
  const articles = data?.articles ?? [];
  const pages = Math.max(1, Math.ceil((data?.total ?? 0) / PAGE_SIZE));
  const link = (p: number) => `/articles?${new URLSearchParams({ ...(tag ? { tag } : {}), page: String(p) })}`;

  return (
    <>
      <PageTitle title={tag ? `Bài viết: ${tag}` : 'Bài viết'}>
        {tag && (
          <Link href="/articles" className="text-sm font-semibold text-brand-700 hover:underline">
            Xem tất cả
          </Link>
        )}
      </PageTitle>
      {articles.length === 0 ? (
        <Empty>Chưa có bài viết nào.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a) => (
            <ArticleCard key={a.id} a={a} />
          ))}
        </div>
      )}
      {pages > 1 && (
        <nav aria-label="Phân trang" className="mt-8 flex items-center justify-center gap-3 text-sm">
          {page > 1 && (
            <Link href={link(page - 1)} className="rounded-2xl border border-line bg-surface px-4 py-2 font-medium hover:bg-brand-50">
              ← Trang trước
            </Link>
          )}
          <span className="text-muted">
            Trang {page}/{pages}
          </span>
          {page < pages && (
            <Link href={link(page + 1)} className="rounded-2xl border border-line bg-surface px-4 py-2 font-medium hover:bg-brand-50">
              Trang sau →
            </Link>
          )}
        </nav>
      )}
    </>
  );
}

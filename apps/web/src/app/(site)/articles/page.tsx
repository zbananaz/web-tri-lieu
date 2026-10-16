import type { ArticleSummary } from '@wtl/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ArticleCard } from '@/components/cards';
import { PageBanner } from '@/components/PageBanner';
import { Empty } from '@/components/ui';
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
      <div className="mb-8 sm:mb-10">
        <PageBanner photo="chanhNiem" eyebrow="Góc chia sẻ" title={tag ? `Bài viết: ${tag}` : 'Bài viết'}>
          <p>Kiến thức nhẹ nhàng về sức khỏe tinh thần, để bạn hiểu mình hơn mỗi ngày.</p>
          {tag && (
            <Link href="/articles" className="mt-3 inline-block text-sm font-semibold text-white underline underline-offset-4">
              Xem tất cả
            </Link>
          )}
        </PageBanner>
      </div>
      {articles.length === 0 ? (
        <Empty>Chưa có bài viết nào.</Empty>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {articles.map((a, i) => {
            const featured = i === 0 && page === 1 && !tag && articles.length > 3;
            return (
              <div key={a.id} className={featured ? 'sm:col-span-2' : ''}>
                <ArticleCard a={a} featured={featured} />
              </div>
            );
          })}
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

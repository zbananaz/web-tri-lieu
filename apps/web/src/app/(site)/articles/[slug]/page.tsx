import type { ArticleDetail } from '@wtl/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Badge } from '@/components/ui';
import { formatDate } from '@/lib/format';
import { serverApi } from '@/lib/server-api';

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

async function load(slug: string) {
  if (!SLUG.test(slug) || slug.length > 120) return null;
  const r = await serverApi<{ article: ArticleDetail }>(`/articles/${slug}`);
  return r?.article ?? null;
}

export async function generateMetadata({ params }: PageProps<'/articles/[slug]'>): Promise<Metadata> {
  const a = await load((await params).slug);
  if (!a) return { title: 'Không tìm thấy bài viết' };
  return {
    title: a.title,
    description: a.excerpt || undefined,
    alternates: { canonical: `/articles/${a.slug}` },
    openGraph: {
      type: 'article',
      title: a.title,
      description: a.excerpt || undefined,
      publishedTime: a.publishedAt ?? undefined,
      images: a.coverUrl ? [a.coverUrl] : undefined,
    },
  };
}

export default async function ArticlePage({ params }: PageProps<'/articles/[slug]'>) {
  const a = await load((await params).slug);
  if (!a) notFound();

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: a.title,
    description: a.excerpt,
    datePublished: a.publishedAt,
    author: { '@type': 'Person', name: a.authorName },
    // Anh tai len la duong dan tuong doi: JSON-LD can URL tuyet doi
    image: a.coverUrl ? new URL(a.coverUrl, process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000').toString() : undefined,
  };

  return (
    <article className="mx-auto max-w-3xl">
      <Link href="/articles" className="text-sm font-semibold text-brand-700 hover:underline">
        ← Tất cả bài viết
      </Link>
      <header className="mt-4 space-y-3">
        <div className="flex flex-wrap gap-1.5">
          {a.tags.map((t) => (
            <Link key={t} href={`/articles?tag=${encodeURIComponent(t)}`}>
              <Badge tone="brand">{t.replace(/-/g, ' ')}</Badge>
            </Link>
          ))}
        </div>
        <h1 className="text-3xl font-bold leading-tight sm:text-4xl">{a.title}</h1>
        <p className="text-sm text-muted">
          {a.authorName}
          {a.publishedAt && ` · ${formatDate(a.publishedAt)}`}
        </p>
      </header>
      {a.coverUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={a.coverUrl} alt="" className="mt-6 aspect-[16/9] w-full rounded-2xl object-cover" />
      )}
      {/* contentHtml da duoc may chu lam sach (sanitize-html, danh sach trang) truoc khi luu */}
      <div className="prose-article mt-8" dangerouslySetInnerHTML={{ __html: a.contentHtml }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />
    </article>
  );
}

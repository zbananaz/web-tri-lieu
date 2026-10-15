import type { PublicExpert } from '@wtl/shared';
import type { ArticleSummary } from '@wtl/shared';
import type { MetadataRoute } from 'next';
import { serverApi } from '@/lib/server-api';

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? 'http://localhost:3000';

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const [articles, experts] = await Promise.all([
    serverApi<{ articles: ArticleSummary[] }>('/articles?page=1&pageSize=100', 300),
    serverApi<{ experts: PublicExpert[] }>('/experts', 300),
  ]);
  return [
    { url: SITE, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE}/experts`, changeFrequency: 'weekly', priority: 0.8 },
    { url: `${SITE}/articles`, changeFrequency: 'daily', priority: 0.8 },
    ...(experts?.experts ?? []).map((e) => ({ url: `${SITE}/experts/${e.id}`, changeFrequency: 'monthly' as const, priority: 0.6 })),
    ...(articles?.articles ?? []).map((a) => ({
      url: `${SITE}/articles/${a.slug}`,
      lastModified: a.publishedAt ?? undefined,
      changeFrequency: 'monthly' as const,
      priority: 0.7,
    })),
  ];
}

import type { PublicExpert } from '@wtl/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpertCard } from '@/components/cards';
import { Empty, PageTitle } from '@/components/ui';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'Đội ngũ chuyên gia',
  description: 'Gặp gỡ các chuyên gia tâm lý của chúng tôi: chuyên môn, kinh nghiệm và hình thức trị liệu.',
  alternates: { canonical: '/experts' },
};

export default async function ExpertsPage({ searchParams }: PageProps<'/experts'>) {
  const sp = await searchParams;
  const slug = typeof sp.s === 'string' ? sp.s : undefined;
  const [data, specs] = await Promise.all([
    serverApi<{ experts: PublicExpert[] }>('/experts'),
    serverApi<{ specialties: { slug: string; name: string }[] }>('/specialties'),
  ]);
  const experts = (data?.experts ?? []).filter((e) => !slug || e.specialties.some((s) => s.slug === slug));

  return (
    <>
      <PageTitle title="Đội ngũ chuyên gia" />
      <nav aria-label="Lọc theo lĩnh vực" className="mb-6 flex flex-wrap gap-2">
        {[{ slug: undefined, name: 'Tất cả' }, ...(specs?.specialties ?? [])].map((s) => {
          const on = s.slug === slug;
          return (
            <Link
              key={s.slug ?? 'all'}
              href={s.slug ? `/experts?s=${s.slug}` : '/experts'}
              aria-current={on ? 'true' : undefined}
              className={`rounded-full border px-4 py-2 text-sm font-medium ${on ? 'border-brand-600 bg-brand-600 text-white' : 'border-line bg-surface hover:bg-brand-50'}`}
            >
              {s.name}
            </Link>
          );
        })}
      </nav>
      {experts.length === 0 ? (
        <Empty>Chưa có chuyên gia phù hợp với bộ lọc này.</Empty>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {experts.map((e) => (
            <ExpertCard key={e.id} e={e} />
          ))}
        </div>
      )}
    </>
  );
}

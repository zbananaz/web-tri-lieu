import { EXPERT_SORTS, type PublicExpert } from '@wtl/shared';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ExpertCard } from '@/components/cards';
import { PageBanner } from '@/components/PageBanner';
import { Button, Empty, SelectField, TextField } from '@/components/ui';
import { serverApi } from '@/lib/server-api';

export const metadata: Metadata = {
  title: 'Đội ngũ chuyên gia',
  description: 'Gặp gỡ các chuyên gia tâm lý của chúng tôi: chuyên môn, kinh nghiệm và hình thức trị liệu.',
  alternates: { canonical: '/experts' },
};

const SORT_LABELS: Record<(typeof EXPERT_SORTS)[number], string> = {
  name: 'Tên A–Z',
  soonest: 'Có giờ trống sớm nhất',
  rating: 'Đánh giá cao nhất',
};
const FEES = [300_000, 500_000, 800_000, 1_000_000];
const LANGUAGES = [
  { value: 'vi', label: 'Tiếng Việt' },
  { value: 'en', label: 'Tiếng Anh' },
];

const one = (v: string | string[] | undefined) => (typeof v === 'string' ? v : undefined);

export default async function ExpertsPage({ searchParams }: PageProps<'/experts'>) {
  const sp = await searchParams;
  const q = one(sp.q)?.slice(0, 80) ?? '';
  const specialty = one(sp.specialty) ?? one(sp.s) ?? ''; // `s` la ten tham so cu
  const mode = one(sp.mode) ?? '';
  const language = one(sp.language) ?? '';
  const maxFee = one(sp.maxFee) ?? '';
  const sortRaw = one(sp.sort);
  const sort = EXPERT_SORTS.find((s) => s === sortRaw) ?? 'name';

  const qs = new URLSearchParams();
  if (q.trim()) qs.set('q', q.trim());
  if (specialty) qs.set('specialty', specialty);
  if (mode) qs.set('mode', mode);
  if (language) qs.set('language', language);
  if (/^\d+$/.test(maxFee)) qs.set('maxFee', maxFee);
  qs.set('sort', sort);

  const [data, specs] = await Promise.all([
    serverApi<{ experts: PublicExpert[] }>(`/experts?${qs}`),
    serverApi<{ specialties: { slug: string; name: string }[] }>('/specialties'),
  ]);
  const experts = data?.experts ?? [];
  const filtered = qs.size > 1;

  return (
    <>
      <div className="mb-6">
        <PageBanner photo="troChuyen" eyebrow="Đội ngũ" title="Đội ngũ chuyên gia">
          <p>Mỗi chuyên gia đều có hồ sơ, chuyên môn và giờ trống rõ ràng, để bạn biết trước mình sẽ gặp ai.</p>
        </PageBanner>
      </div>
      <form method="get" action="/experts" aria-label="Tìm chuyên gia" className="mb-6 space-y-4 rounded-3xl border border-line/70 bg-surface p-4 shadow-soft sm:p-5">
        <TextField label="Tìm theo tên hoặc chuyên môn" name="q" defaultValue={q} maxLength={80} placeholder="Ví dụ: lo âu, trầm cảm, cặp đôi…" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          <SelectField label="Lĩnh vực" name="specialty" defaultValue={specialty}>
            <option value="">Tất cả</option>
            {(specs?.specialties ?? []).map((s) => (
              <option key={s.slug} value={s.slug}>
                {s.name}
              </option>
            ))}
          </SelectField>
          <SelectField label="Hình thức" name="mode" defaultValue={mode}>
            <option value="">Tất cả</option>
            <option value="online">Trực tuyến</option>
            <option value="in_person">Trực tiếp</option>
          </SelectField>
          <SelectField label="Ngôn ngữ" name="language" defaultValue={language}>
            <option value="">Tất cả</option>
            {LANGUAGES.map((l) => (
              <option key={l.value} value={l.value}>
                {l.label}
              </option>
            ))}
          </SelectField>
          <SelectField label="Chi phí tối đa" name="maxFee" defaultValue={maxFee}>
            <option value="">Không giới hạn</option>
            {FEES.map((f) => (
              <option key={f} value={f}>
                Đến {new Intl.NumberFormat('vi-VN').format(f)} đ
              </option>
            ))}
          </SelectField>
          <SelectField label="Sắp xếp" name="sort" defaultValue={sort}>
            {EXPERT_SORTS.map((s) => (
              <option key={s} value={s}>
                {SORT_LABELS[s]}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <Button type="submit">Tìm chuyên gia</Button>
          {filtered && (
            <Link href="/experts" className="text-sm font-semibold text-brand-700 hover:underline">
              Xóa bộ lọc
            </Link>
          )}
        </div>
      </form>
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

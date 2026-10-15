import type { PublicExpert, PublicReview } from '@wtl/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Avatar, RatingLine, Stars } from '@/components/cards';
import { Badge, Card, LinkButton } from '@/components/ui';
import { formatDate, formatDateTime, formatVnd, MODE_LABELS } from '@/lib/format';
import { serverApi } from '@/lib/server-api';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function load(id: string) {
  if (!UUID.test(id)) return null;
  return serverApi<PublicExpert>(`/experts/${id}`);
}

export async function generateMetadata({ params }: PageProps<'/experts/[id]'>): Promise<Metadata> {
  const e = await load((await params).id);
  if (!e) return { title: 'Không tìm thấy chuyên gia' };
  return { title: e.fullName, description: e.headline, alternates: { canonical: `/experts/${e.id}` } };
}

export default async function ExpertPage({ params }: PageProps<'/experts/[id]'>) {
  const e = await load((await params).id);
  if (!e) notFound();
  const reviews = (await serverApi<{ reviews: PublicReview[] }>(`/experts/${e.id}/reviews`))?.reviews ?? [];

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar name={e.fullName} url={e.avatarUrl} size={96} />
        <div>
          <h1 className="text-3xl font-bold">{e.fullName}</h1>
          <p className="mt-1 text-lg text-muted">{e.headline}</p>
          <div className="mt-2">
            <RatingLine rating={e.rating} />
          </div>
          <div className="mt-3 flex flex-wrap justify-center gap-1.5 sm:justify-start">
            {e.specialties.map((s) => (
              <Badge key={s.slug} tone="brand">
                {s.name}
              </Badge>
            ))}
          </div>
        </div>
      </header>

      <Card>
        <dl className="grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-sm text-muted">Kinh nghiệm</dt>
            <dd className="font-semibold">{e.yearsExperience} năm</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Hình thức</dt>
            <dd className="font-semibold">{e.modes.map((m) => MODE_LABELS[m] ?? m).join(', ')}</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Thời lượng mỗi buổi</dt>
            <dd className="font-semibold">{e.sessionMinutes} phút</dd>
          </div>
          <div>
            <dt className="text-sm text-muted">Chi phí tham khảo</dt>
            <dd className="font-semibold">{formatVnd(e.feeVnd)}</dd>
          </div>
          {e.nextSlot && (
            <div className="sm:col-span-2">
              <dt className="text-sm text-muted">Giờ trống gần nhất</dt>
              <dd className="font-semibold text-ok-600">{formatDateTime(e.nextSlot)}</dd>
            </div>
          )}
        </dl>
      </Card>

      {e.bio && (
        <section>
          <h2 className="text-xl font-bold">Giới thiệu</h2>
          <p className="mt-2 whitespace-pre-line text-muted">{e.bio}</p>
        </section>
      )}
      {e.credentials && (
        <section>
          <h2 className="text-xl font-bold">Học vấn & chứng chỉ</h2>
          <p className="mt-2 whitespace-pre-line text-muted">{e.credentials}</p>
        </section>
      )}

      <section aria-labelledby="reviews-title">
        <h2 id="reviews-title" className="text-xl font-bold">
          Đánh giá từ khách hàng
        </h2>
        {reviews.length === 0 ? (
          <p className="mt-2 text-muted">Chưa có đánh giá nào được công bố.</p>
        ) : (
          <ul className="mt-3 space-y-3">
            {reviews.map((r) => (
              <li key={r.id}>
                <Card className="space-y-1.5 !p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="flex items-center gap-2">
                      <Stars value={r.rating} />
                      <span className="sr-only">{r.rating} trên 5 sao</span>
                      <span className="text-sm font-semibold">Khách hàng</span>
                    </span>
                    <span className="text-xs text-muted">{formatDate(r.createdAt)}</span>
                  </div>
                  {r.comment && <p className="whitespace-pre-line text-sm text-muted">{r.comment}</p>}
                </Card>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Card className="bg-brand-50 text-center">
        <p className="font-semibold">Muốn làm việc với chuyên gia này?</p>
        <p className="mt-1 text-sm text-muted">Bắt đầu bằng bài sàng lọc ngắn; chúng tôi sẽ ghép bạn với chuyên gia phù hợp nhất.</p>
        <LinkButton href="/screening" className="mt-4">
          Bắt đầu sàng lọc
        </LinkButton>
      </Card>
    </article>
  );
}

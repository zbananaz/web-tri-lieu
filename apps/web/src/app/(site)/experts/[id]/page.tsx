import type { PublicExpert } from '@wtl/shared';
import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Avatar } from '@/components/cards';
import { Badge, Card, LinkButton } from '@/components/ui';
import { formatVnd, MODE_LABELS } from '@/lib/format';
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

  return (
    <article className="mx-auto max-w-3xl space-y-6">
      <header className="flex flex-col items-center gap-4 text-center sm:flex-row sm:text-left">
        <Avatar name={e.fullName} url={e.avatarUrl} size={96} />
        <div>
          <h1 className="text-3xl font-bold">{e.fullName}</h1>
          <p className="mt-1 text-lg text-muted">{e.headline}</p>
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

import type { ArticleSummary, PublicExpert } from '@wtl/shared';
import Link from 'next/link';
import { ArticleCard, ExpertCard } from '@/components/cards';
import { LeafMark } from '@/components/LeafMark';
import { LinkButton } from '@/components/ui';
import { serverApi } from '@/lib/server-api';

const STEPS = [
  { n: 1, title: 'Sàng lọc ban đầu', text: 'Trả lời vài câu hỏi ngắn, hoàn toàn riêng tư, để chúng tôi hiểu bạn đang cần gì.' },
  { n: 2, title: 'Được duyệt & ghép chuyên gia', text: 'Đội ngũ xem xét hồ sơ và chọn chuyên gia phù hợp với vấn đề và mong muốn của bạn.' },
  { n: 3, title: 'Đặt lịch hẹn', text: 'Chọn khung giờ trống của chuyên gia, trực tuyến hoặc trực tiếp.' },
  { n: 4, title: 'Trò chuyện an toàn', text: 'Nhắn tin riêng tư với chuyên gia trước và giữa các buổi hẹn.' },
];

export default async function HomePage() {
  const [experts, articles] = await Promise.all([
    serverApi<{ experts: PublicExpert[] }>('/experts'),
    serverApi<{ articles: ArticleSummary[] }>('/articles?pageSize=3'),
  ]);

  return (
    <div className="space-y-20 sm:space-y-28">
      <section className="grid items-center gap-8 md:grid-cols-2">
        <div className="space-y-5">
          <p className="inline-block rounded-full bg-brand-100 px-4 py-1.5 text-sm font-medium text-brand-700">Riêng tư · Tận tâm · Dễ tiếp cận</p>
          <h1 className="text-4xl leading-[1.15] sm:text-5xl">Bạn không phải một mình vượt qua điều này</h1>
          <p className="text-lg text-muted">
            Chúng tôi kết nối bạn với chuyên gia tâm lý phù hợp. Bắt đầu bằng một bài sàng lọc ngắn, chúng tôi sẽ lo phần còn lại.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <LinkButton href="/screening" className="px-6">
              Bắt đầu sàng lọc
            </LinkButton>
            <LinkButton href="/experts" variant="secondary" className="px-6">
              Xem đội ngũ chuyên gia
            </LinkButton>
          </div>
        </div>
        <div aria-hidden className="relative aspect-[4/3] overflow-hidden rounded-[2.5rem] bg-gradient-to-br from-brand-100 via-warm-100 to-brand-50 shadow-soft">
          <div className="absolute -left-10 top-10 size-56 rounded-full bg-brand-500/25 blur-2xl" />
          <div className="absolute -bottom-12 right-4 size-64 rounded-full bg-warm-600/15 blur-3xl" />
          <div className="absolute inset-0 grid place-items-center text-brand-600">
            <LeafMark className="size-28 opacity-60 sm:size-36" />
          </div>
        </div>
      </section>

      <section aria-labelledby="how">
        <h2 id="how" className="text-2xl sm:text-3xl">
          Quy trình đồng hành
        </h2>
        <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s) => (
            <li key={s.n} className="rounded-3xl border border-line/70 bg-surface p-6 shadow-soft">
              <span className="grid size-10 place-items-center rounded-full bg-brand-100 font-[family-name:var(--font-display)] text-lg font-semibold text-brand-700">{s.n}</span>
              <h3 className="mt-3 font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted">{s.text}</p>
            </li>
          ))}
        </ol>
      </section>

      {experts && experts.experts.length > 0 && (
        <section aria-labelledby="experts">
          <div className="flex items-end justify-between gap-3">
            <h2 id="experts" className="text-2xl sm:text-3xl">
              Chuyên gia của chúng tôi
            </h2>
            <Link href="/experts" className="text-sm font-semibold text-brand-700 hover:underline">
              Xem tất cả →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {experts.experts.slice(0, 3).map((e) => (
              <ExpertCard key={e.id} e={e} />
            ))}
          </div>
        </section>
      )}

      {articles && articles.articles.length > 0 && (
        <section aria-labelledby="articles">
          <div className="flex items-end justify-between gap-3">
            <h2 id="articles" className="text-2xl sm:text-3xl">
              Góc chia sẻ
            </h2>
            <Link href="/articles" className="text-sm font-semibold text-brand-700 hover:underline">
              Xem tất cả →
            </Link>
          </div>
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {articles.articles.map((a) => (
              <ArticleCard key={a.id} a={a} />
            ))}
          </div>
        </section>
      )}

      <section className="rounded-[2.5rem] bg-brand-700 px-6 py-14 text-center text-white sm:px-12">
        <h2 className="text-2xl sm:text-3xl">Thông tin của bạn được bảo vệ</h2>
        <p className="mx-auto mt-3 max-w-2xl text-brand-100">
          Câu trả lời sàng lọc và nội dung trò chuyện chỉ hiển thị cho những người trực tiếp hỗ trợ bạn. Mọi lần truy cập của quản trị viên đều được ghi lại.
        </p>
        <LinkButton href="/screening" variant="secondary" className="mt-6 px-6">
          Bắt đầu ngay
        </LinkButton>
      </section>
    </div>
  );
}

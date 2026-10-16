import type { ArticleSummary, PublicExpert } from '@wtl/shared';
import Link from 'next/link';
import { ArticleCard, ExpertCard } from '@/components/cards';
import { Photo } from '@/components/Photo';
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
    <div className="space-y-24 sm:space-y-32">
      {/* Hero: chữ trái, ảnh vòm phải */}
      <section className="grid items-center gap-10 md:grid-cols-12 md:gap-8">
        <div className="space-y-5 md:col-span-7">
          <p className="inline-block rounded-full bg-brand-100 px-4 py-1.5 text-sm font-medium text-brand-700">Riêng tư · Tận tâm · Dễ tiếp cận</p>
          <h1 className="text-4xl leading-[1.15] sm:text-5xl lg:text-6xl">Bạn không phải một mình vượt qua điều này</h1>
          <p className="max-w-xl text-lg text-muted">
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
        <div className="relative mx-auto w-full max-w-sm md:col-span-5 md:max-w-none">
          <div aria-hidden className="absolute -bottom-6 -left-6 -z-10 size-3/4 rounded-full bg-sand-100" />
          <Photo
            name="tuVan"
            eager
            sizes="(min-width: 768px) 40vw, 90vw"
            className="aspect-[4/5] rounded-t-[999px] rounded-b-[2rem] shadow-lift"
          />
          <p className="absolute -bottom-4 left-4 max-w-[15rem] rounded-2xl bg-surface px-4 py-3 text-sm shadow-lift sm:-left-6">
            <span className="font-semibold text-brand-700">Được lắng nghe</span>
            <span className="block text-muted">trong một cuộc trò chuyện riêng tư với chuyên gia.</span>
          </p>
        </div>
      </section>

      {/* Quy trình: ảnh sticky trái, bốn bước phải */}
      <section aria-labelledby="how" className="grid gap-10 md:grid-cols-12 md:gap-12">
        <div className="md:col-span-5">
          <div className="md:sticky md:top-24">
            <Photo name="khongGian" sizes="(min-width: 768px) 40vw, 100vw" className="aspect-[5/4] rounded-[2rem] shadow-soft md:aspect-[4/5]" />
            <p className="mt-3 text-sm text-muted">Không gian tư vấn trực tiếp: yên tĩnh, kín đáo, nhiều ánh sáng tự nhiên.</p>
          </div>
        </div>
        <div className="md:col-span-7">
          <h2 id="how" className="text-2xl sm:text-3xl">
            Quy trình đồng hành
          </h2>
          <p className="mt-2 max-w-xl text-muted">Bốn bước rõ ràng, bạn luôn biết mình đang ở đâu và điều gì sẽ diễn ra tiếp theo.</p>
          <ol className="mt-8 space-y-6 border-l border-line pl-6 sm:pl-8">
            {STEPS.map((s) => (
              <li key={s.n} className="relative">
                <span className="absolute -left-[2.35rem] top-0 grid size-9 place-items-center rounded-full bg-brand-100 font-[family-name:var(--font-display)] text-base font-semibold text-brand-700 ring-4 ring-bg sm:-left-[2.85rem]">
                  {s.n}
                </span>
                <h3 className="text-lg font-semibold">{s.title}</h3>
                <p className="mt-1 text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Chuyên gia: banner ảnh, thẻ chồng lên mép dưới */}
      {experts && experts.experts.length > 0 && (
        <section aria-labelledby="experts">
          <div className="relative isolate overflow-hidden rounded-[2rem] bg-cocoa px-6 pb-28 pt-12 text-white sm:rounded-[2.5rem] sm:px-12 sm:pt-16">
            <Photo name="troChuyen" sizes="(min-width: 1152px) 1100px, 100vw" className="absolute inset-0 -z-10" />
            <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-r from-cocoa/90 via-cocoa/65 to-cocoa/25" />
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div className="max-w-xl">
                <h2 id="experts" className="text-2xl text-white sm:text-3xl">
                  Chuyên gia của chúng tôi
                </h2>
                <p className="mt-2 text-white/85">Những người sẽ ngồi cùng bạn, lắng nghe trước khi đưa ra bất cứ lời khuyên nào.</p>
              </div>
              <Link href="/experts" className="text-sm font-semibold text-white underline-offset-4 hover:underline">
                Xem tất cả →
              </Link>
            </div>
          </div>
          <div className="relative -mt-20 grid gap-4 px-3 sm:grid-cols-2 sm:px-6 lg:grid-cols-3">
            {experts.experts.slice(0, 3).map((e) => (
              <ExpertCard key={e.id} e={e} />
            ))}
          </div>
        </section>
      )}

      {/* Bài viết: bài đầu nằm ngang */}
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
          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            {articles.articles.map((a, i) => (
              <div key={a.id} className={i === 0 ? 'sm:col-span-2' : ''}>
                <ArticleCard a={a} featured={i === 0} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Về chúng tôi */}
      <section aria-labelledby="about" className="grid items-center gap-8 md:grid-cols-12 md:gap-12">
        <div className="space-y-4 md:order-2 md:col-span-6">
          <p className="text-sm font-medium tracking-wide text-brand-600">Về chúng tôi</p>
          <h2 id="about" className="text-2xl sm:text-3xl">
            Chăm sóc tinh thần cần thời gian, như một mầm cây cần đất tốt
          </h2>
          <p className="text-muted">
            Chúng tôi tin mỗi người đều có sẵn sức mạnh để lớn lên. Việc của một nơi trị liệu là giữ cho không gian đủ an toàn để điều đó diễn ra, không vội vàng và không phán xét.
          </p>
          <LinkButton href="/ve-chung-toi" variant="secondary" className="px-6">
            Tìm hiểu thêm
          </LinkButton>
        </div>
        <Photo name="coiRe" sizes="(min-width: 768px) 45vw, 100vw" className="aspect-[4/3] rounded-[2rem] shadow-soft md:order-1 md:col-span-6" />
      </section>

      {/* Thông tin được bảo vệ */}
      <section className="grid overflow-hidden rounded-[2rem] bg-cocoa text-white shadow-soft sm:rounded-[2.5rem] md:grid-cols-2">
        <Photo name="banTay" sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[16/10] md:aspect-auto md:min-h-[22rem]" />
        <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
          <h2 className="text-2xl text-white sm:text-3xl">Thông tin của bạn được bảo vệ</h2>
          <p className="mt-3 max-w-xl text-white/85">
            Câu trả lời sàng lọc và nội dung trò chuyện chỉ hiển thị cho những người trực tiếp hỗ trợ bạn. Mọi lần truy cập của quản trị viên đều được ghi lại.
          </p>
          <LinkButton href="/screening" variant="secondary" className="mt-6 self-start px-6">
            Bắt đầu ngay
          </LinkButton>
        </div>
      </section>
    </div>
  );
}

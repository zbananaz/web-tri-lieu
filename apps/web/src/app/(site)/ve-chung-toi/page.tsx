import type { Metadata } from 'next';
import { PageBanner } from '@/components/PageBanner';
import { Photo } from '@/components/Photo';
import { LinkButton } from '@/components/ui';

export const metadata: Metadata = {
  title: 'Về chúng tôi',
  description: 'Cách chúng tôi nghĩ về việc chăm sóc sức khỏe tinh thần: an toàn, không phán xét và đi theo nhịp của bạn.',
  alternates: { canonical: '/ve-chung-toi' },
};

const VALUES = [
  { title: 'An toàn trước hết', text: 'Thông tin sàng lọc và nội dung trò chuyện chỉ hiển thị cho những người trực tiếp hỗ trợ bạn. Mọi lần quản trị viên truy cập đều được ghi lại.' },
  { title: 'Không phán xét', text: 'Bạn không cần giải thích hay biện minh cho cảm xúc của mình. Chuyên gia ở đây để lắng nghe trước.' },
  { title: 'Đi theo nhịp của bạn', text: 'Bạn chọn khung giờ trống và hình thức gặp (trực tuyến hoặc trực tiếp), và có thể bỏ qua những câu hỏi không bắt buộc trong bài sàng lọc.' },
];

export default function AboutPage() {
  return (
    <div className="space-y-20 sm:space-y-28">
      <PageBanner photo="coiRe" eyebrow="Về chúng tôi" title="Mầm cây cần đất tốt và thời gian">
        <p>Chúng tôi xây một nơi để bạn có thể bắt đầu nói về những điều khó nói, theo cách an toàn và nhẹ nhàng nhất có thể.</p>
      </PageBanner>

      <section aria-labelledby="philosophy" className="grid items-center gap-8 md:grid-cols-12 md:gap-12">
        <div className="space-y-4 md:col-span-6">
          <h2 id="philosophy" className="text-2xl sm:text-3xl">
            Chăm sóc tinh thần không phải cuộc chạy đua
          </h2>
          <p className="text-muted">
            Có những ngày ta cần một người ngồi cạnh nhiều hơn là một lời khuyên. Nền tảng này ra đời để rút ngắn khoảng cách giữa lúc bạn thấy mình cần giúp đỡ và lúc bạn thật sự gặp được người phù hợp.
          </p>
          <p className="text-muted">
            Bạn bắt đầu bằng một bài sàng lọc ngắn. Đội ngũ xem xét và ghép bạn với chuyên gia thích hợp, rồi bạn đặt lịch vào khung giờ phù hợp và trò chuyện theo cách mình thấy thoải mái.
          </p>
        </div>
        <Photo name="khongGian" sizes="(min-width: 768px) 45vw, 100vw" className="aspect-[4/3] rounded-[2rem] shadow-soft md:col-span-6" />
      </section>

      <section aria-labelledby="values">
        <h2 id="values" className="text-2xl sm:text-3xl">
          Điều chúng tôi giữ
        </h2>
        <ul className="mt-8 grid gap-4 md:grid-cols-3">
          {VALUES.map((v, i) => (
            <li key={v.title} className={`rounded-3xl p-6 ${i === 1 ? 'bg-sand-100' : 'border border-line/70 bg-surface shadow-soft'}`}>
              <h3 className="font-semibold">{v.title}</h3>
              <p className="mt-2 text-sm text-muted">{v.text}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid overflow-hidden rounded-[2rem] bg-cocoa text-white shadow-soft sm:rounded-[2.5rem] md:grid-cols-2">
        <Photo name="chanhNiem" sizes="(min-width: 768px) 50vw, 100vw" className="aspect-[16/10] md:aspect-auto md:min-h-[20rem]" />
        <div className="flex flex-col justify-center px-6 py-10 sm:px-12">
          <h2 className="text-2xl text-white sm:text-3xl">Sẵn sàng khi bạn sẵn sàng</h2>
          <p className="mt-3 text-white/85">Bước đầu tiên chỉ là vài câu hỏi ngắn. Không ai ép bạn đi nhanh hơn mức bạn muốn.</p>
          <LinkButton href="/screening" variant="secondary" className="mt-6 self-start px-6">
            Bắt đầu sàng lọc
          </LinkButton>
        </div>
      </section>
    </div>
  );
}

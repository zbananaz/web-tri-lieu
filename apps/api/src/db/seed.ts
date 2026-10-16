import { eq, sql } from 'drizzle-orm';
import { hashPassword } from '../auth/password.js';
import { sanitizeArticleHtml } from '../articles/sanitize.js';
import type { Db } from './client.js';
import {
  articles,
  expertAvailability,
  expertProfiles,
  expertSpecialties,
  screeningQuestions,
  specialties,
  users,
} from './schema.js';

export const SEED_ACCOUNTS = {
  admin: 'admin@webtrilieu.local',
  experts: ['bsminh@webtrilieu.local', 'tlhoa@webtrilieu.local'],
  client: 'khach@webtrilieu.local',
} as const;

export const SPECIALTIES = [
  { slug: 'lo-au', name: 'Lo âu' },
  { slug: 'tram-cam', name: 'Trầm cảm' },
  { slug: 'stress-cong-viec', name: 'Căng thẳng công việc' },
  { slug: 'quan-he-gia-dinh', name: 'Quan hệ & gia đình' },
  { slug: 'giac-ngu', name: 'Rối loạn giấc ngủ' },
  { slug: 'tre-vi-thanh-nien', name: 'Trẻ & vị thành niên' },
];

/**
 * NOI DUNG MAU: bo cau hoi sang loc duoi day chi de chay thu he thong.
 * Trung tam/chuyen gia lam sang phai tham dinh va thay the truoc khi dung that (quan tri > Cau hoi sang loc).
 */
const QUESTIONS = [
  {
    position: 1,
    prompt: 'Gần đây điều gì khiến bạn muốn tìm đến chuyên gia?',
    helpText: 'Chọn điều gần nhất với bạn.',
    type: 'single' as const,
    required: true,
    options: [
      { value: 'lo-au', label: 'Hay lo lắng, bồn chồn', specialties: ['lo-au'] },
      { value: 'buon', label: 'Buồn chán, mất hứng thú kéo dài', specialties: ['tram-cam'] },
      { value: 'cong-viec', label: 'Áp lực công việc, học tập', specialties: ['stress-cong-viec'] },
      { value: 'quan-he', label: 'Khó khăn trong các mối quan hệ', specialties: ['quan-he-gia-dinh'] },
      { value: 'giac-ngu', label: 'Khó ngủ, ngủ không sâu', specialties: ['giac-ngu'] },
      { value: 'khac', label: 'Khác' },
    ],
  },
  {
    position: 2,
    prompt: 'Tình trạng này kéo dài bao lâu rồi?',
    type: 'single' as const,
    required: true,
    options: [
      { value: 'duoi-2-tuan', label: 'Dưới 2 tuần' },
      { value: '2-tuan-3-thang', label: '2 tuần đến 3 tháng' },
      { value: 'tren-3-thang', label: 'Hơn 3 tháng' },
    ],
  },
  {
    position: 3,
    prompt: 'Trong 2 tuần qua, bạn có từng nghĩ đến việc làm hại bản thân không?',
    helpText: 'Câu trả lời của bạn được bảo mật. Nếu bạn đang gặp nguy hiểm, hãy gọi ngay 115.',
    type: 'single' as const,
    required: true,
    options: [
      { value: 'khong', label: 'Không' },
      { value: 'thinh-thoang', label: 'Thỉnh thoảng thoáng qua', risk: 'elevated' as const },
      { value: 'thuong-xuyen', label: 'Thường xuyên hoặc đang có ý định', risk: 'urgent' as const },
    ],
  },
  {
    position: 4,
    prompt: 'Bạn muốn chia sẻ thêm điều gì với chuyên gia?',
    type: 'text' as const,
    required: false,
    options: [],
  },
];

const EXPERTS = [
  {
    email: SEED_ACCOUNTS.experts[0],
    fullName: 'ThS. Nguyễn Văn Minh',
    phone: '0901000001',
    headline: 'Thạc sĩ Tâm lý lâm sàng',
    bio: 'Đồng hành cùng thân chủ gặp lo âu, căng thẳng công việc. (Hồ sơ mẫu)',
    credentials: 'Thạc sĩ Tâm lý lâm sàng (mẫu)',
    yearsExperience: 8,
    modes: ['online', 'in_person'],
    feeVnd: 500_000,
    specs: ['lo-au', 'stress-cong-viec', 'giac-ngu'],
    days: [1, 2, 3, 4, 5],
  },
  {
    email: SEED_ACCOUNTS.experts[1],
    fullName: 'CN. Trần Thu Hoa',
    phone: '0901000002',
    headline: 'Chuyên viên tham vấn tâm lý',
    bio: 'Quan tâm đến trầm cảm, quan hệ gia đình và thanh thiếu niên. (Hồ sơ mẫu)',
    credentials: 'Cử nhân Tâm lý học (mẫu)',
    yearsExperience: 5,
    modes: ['online'],
    feeVnd: 350_000,
    specs: ['tram-cam', 'quan-he-gia-dinh', 'tre-vi-thanh-nien'],
    days: [2, 4, 6],
  },
];

const ARTICLES = [
  {
    slug: 'nhan-biet-dau-hieu-lo-au',
    title: 'Nhận biết sớm các dấu hiệu lo âu',
    excerpt: 'Lo lắng là bình thường, nhưng khi nào nó cần được quan tâm?',
    tags: ['lo-au', 'suc-khoe-tinh-than'],
    contentHtml:
      '<h2>Lo âu khác với lo lắng thường ngày</h2><p>Ai cũng có lúc lo lắng. Khi cảm giác này kéo dài, khó kiểm soát và ảnh hưởng đến giấc ngủ, công việc hay các mối quan hệ, bạn nên trò chuyện với chuyên gia.</p><h3>Một số dấu hiệu thường gặp</h3><ul><li>Hồi hộp, bồn chồn kéo dài</li><li>Khó tập trung, dễ cáu gắt</li><li>Mất ngủ hoặc ngủ không sâu</li></ul><p><em>Bài viết mang tính tham khảo, không thay thế chẩn đoán của chuyên gia.</em></p>',
  },
  {
    slug: 'thoi-quen-giup-ngu-ngon-hon',
    title: 'Năm thói quen giúp ngủ ngon hơn',
    excerpt: 'Những điều chỉnh nhỏ trong sinh hoạt hằng ngày có thể cải thiện giấc ngủ rõ rệt.',
    tags: ['giac-ngu'],
    contentHtml:
      '<h2>Giữ giờ ngủ đều đặn</h2><p>Đi ngủ và thức dậy cùng giờ mỗi ngày giúp đồng hồ sinh học ổn định.</p><h2>Hạn chế màn hình trước khi ngủ</h2><p>Ánh sáng xanh và nội dung kích thích khiến não khó thư giãn.</p><blockquote>Ngủ đủ là một phần của chăm sóc sức khỏe tinh thần.</blockquote>',
  },
  {
    slug: 'khi-nao-nen-gap-chuyen-gia-tam-ly',
    title: 'Khi nào nên gặp chuyên gia tâm lý?',
    excerpt: 'Tìm kiếm sự hỗ trợ sớm giúp việc phục hồi dễ dàng hơn.',
    tags: ['suc-khoe-tinh-than'],
    contentHtml:
      '<h2>Không cần đợi đến khủng hoảng</h2><p>Bạn có thể bắt đầu khi cảm thấy mình không còn là mình, hoặc khi những cách tự xoay xở không còn hiệu quả.</p><p>Nếu bạn đang có ý nghĩ làm hại bản thân, hãy gọi ngay <strong>115</strong> hoặc đến cơ sở y tế gần nhất.</p>',
  },
];

/** Idempotent: chay lai nhieu lan khong tao trung. Khong bao gio dung o production. */
export async function seed(db: Db, password: string): Promise<void> {
  const passwordHash = await hashPassword(password);

  await db.insert(specialties).values(SPECIALTIES).onConflictDoNothing();
  const specRows = await db.select().from(specialties);
  const specId = new Map(specRows.map((s) => [s.slug, s.id]));

  const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(screeningQuestions);
  if (n === 0) await db.insert(screeningQuestions).values(QUESTIONS);

  const upsertUser = async (email: string, role: 'admin' | 'expert' | 'client', fullName: string, phone: string) => {
    await db.insert(users).values({ email, passwordHash, role, fullName, phone }).onConflictDoNothing();
    const [u] = await db.select({ id: users.id }).from(users).where(eq(users.email, email));
    return u!.id;
  };

  const adminId = await upsertUser(SEED_ACCOUNTS.admin, 'admin', 'Quản trị viên', '0900000000');
  await upsertUser(SEED_ACCOUNTS.client, 'client', 'Khách thử nghiệm', '0900000001');

  for (const e of EXPERTS) {
    const id = await upsertUser(e.email, 'expert', e.fullName, e.phone);
    await db
      .insert(expertProfiles)
      .values({
        userId: id,
        headline: e.headline,
        bio: e.bio,
        credentials: e.credentials,
        yearsExperience: e.yearsExperience,
        modes: e.modes,
        feeVnd: e.feeVnd,
      })
      .onConflictDoNothing();
    for (const slug of e.specs) {
      await db.insert(expertSpecialties).values({ expertId: id, specialtyId: specId.get(slug)! }).onConflictDoNothing();
    }
    const [has] = await db.select({ id: expertAvailability.id }).from(expertAvailability).where(eq(expertAvailability.expertId, id)).limit(1);
    if (!has) {
      await db.insert(expertAvailability).values(
        e.days.flatMap((weekday) => [
          { expertId: id, weekday, startMinute: 9 * 60, endMinute: 12 * 60 },
          { expertId: id, weekday, startMinute: 14 * 60, endMinute: 18 * 60 },
        ]),
      );
    }
  }

  for (const a of ARTICLES) {
    await db
      .insert(articles)
      .values({
        ...a,
        contentHtml: sanitizeArticleHtml(a.contentHtml),
        status: 'published',
        publishedAt: new Date(),
        authorId: adminId,
      })
      .onConflictDoNothing();
  }
}

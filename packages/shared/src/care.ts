import { z } from 'zod';
import { emailSchema, passwordSchema } from './auth.js';
import { SESSION_MODES } from './experts.js';

// ---------- Tự đánh giá PHQ-9 / GAD-7 ----------
// Hai thang đo này là tài liệu công khai. Lời dịch tiếng Việt bên dưới là bản NHÁP, cần chuyên gia lâm sàng thẩm định
// trước khi dùng thật. Kết quả chỉ để tham khảo, không phải chẩn đoán.

export const ASSESSMENT_KINDS = ['phq9', 'gad7'] as const;
export type AssessmentKind = (typeof ASSESSMENT_KINDS)[number];

export const ASSESSMENT_CHOICES = [
  { value: 0, label: 'Không bao giờ' },
  { value: 1, label: 'Vài ngày' },
  { value: 2, label: 'Hơn một nửa số ngày' },
  { value: 3, label: 'Gần như mỗi ngày' },
] as const;

interface Band {
  max: number;
  key: string;
  label: string;
}

export interface AssessmentDef {
  kind: AssessmentKind;
  title: string;
  intro: string;
  items: readonly string[];
  maxScore: number;
  bands: readonly Band[];
  /** Vị trí câu hỏi nhạy cảm (ý nghĩ làm hại bản thân): trả lời khác 0 là hiện hotline ngay. */
  urgentItem?: number;
}

export const ASSESSMENTS: Record<AssessmentKind, AssessmentDef> = {
  phq9: {
    kind: 'phq9',
    title: 'PHQ-9: Sàng lọc triệu chứng trầm cảm',
    intro: 'Trong 2 tuần qua, bạn thường gặp những vấn đề sau với tần suất thế nào?',
    items: [
      'Ít hứng thú hoặc không thấy vui khi làm mọi việc',
      'Cảm thấy buồn bã, chán nản hoặc tuyệt vọng',
      'Khó ngủ, ngủ không yên hoặc ngủ quá nhiều',
      'Cảm thấy mệt mỏi hoặc ít sức sống',
      'Ăn kém ngon miệng hoặc ăn quá nhiều',
      'Cảm thấy tồi tệ về bản thân, thấy mình thất bại hoặc làm gia đình thất vọng',
      'Khó tập trung vào việc như đọc báo hay xem tivi',
      'Nói hoặc cử động chậm đến mức người khác để ý; hoặc ngược lại, bồn chồn, đứng ngồi không yên hơn thường lệ',
      'Có ý nghĩ rằng thà chết đi còn hơn, hoặc nghĩ đến việc làm hại bản thân',
    ],
    maxScore: 27,
    bands: [
      { max: 4, key: 'minimal', label: 'Rất nhẹ hoặc không đáng kể' },
      { max: 9, key: 'mild', label: 'Nhẹ' },
      { max: 14, key: 'moderate', label: 'Trung bình' },
      { max: 19, key: 'moderately_severe', label: 'Khá nặng' },
      { max: 27, key: 'severe', label: 'Nặng' },
    ],
    urgentItem: 8,
  },
  gad7: {
    kind: 'gad7',
    title: 'GAD-7: Sàng lọc triệu chứng lo âu',
    intro: 'Trong 2 tuần qua, bạn thường gặp những vấn đề sau với tần suất thế nào?',
    items: [
      'Cảm thấy bồn chồn, lo lắng hoặc căng thẳng',
      'Không thể ngừng hoặc kiểm soát được sự lo lắng',
      'Lo lắng quá nhiều về nhiều việc khác nhau',
      'Khó thư giãn',
      'Bồn chồn đến mức khó ngồi yên',
      'Dễ bực mình hoặc cáu gắt',
      'Cảm thấy sợ hãi như thể có điều gì tồi tệ sắp xảy ra',
    ],
    maxScore: 21,
    bands: [
      { max: 4, key: 'minimal', label: 'Rất nhẹ hoặc không đáng kể' },
      { max: 9, key: 'mild', label: 'Nhẹ' },
      { max: 14, key: 'moderate', label: 'Trung bình' },
      { max: 21, key: 'severe', label: 'Nặng' },
    ],
  },
};

export interface AssessmentScore {
  score: number;
  severity: string;
  label: string;
  /** Cần hiện hotline và gợi ý gặp chuyên gia ngay. */
  urgent: boolean;
}

/** Tính điểm từ câu trả lời. Máy chủ dùng đúng hàm này, không tin điểm do client gửi. */
export function scoreAssessment(kind: AssessmentKind, answers: readonly number[]): AssessmentScore {
  const def = ASSESSMENTS[kind];
  const score = answers.reduce((a, b) => a + b, 0);
  const band = def.bands.find((b) => score <= b.max) ?? def.bands[def.bands.length - 1]!;
  const urgentByItem = def.urgentItem !== undefined && (answers[def.urgentItem] ?? 0) > 0;
  const urgent = urgentByItem || band.key === 'severe' || band.key === 'moderately_severe';
  return { score, severity: band.key, label: band.label, urgent };
}

export const assessmentAnswersSchema = (kind: AssessmentKind) =>
  z.array(z.number().int().min(0).max(3)).length(ASSESSMENTS[kind].items.length);

export const saveAssessmentSchema = z
  .object({
    kind: z.enum(ASSESSMENT_KINDS),
    answers: z.array(z.number().int().min(0).max(3)).max(20),
    shared: z.boolean().default(false),
  })
  .superRefine((v, ctx) => {
    if (v.answers.length !== ASSESSMENTS[v.kind].items.length) {
      ctx.addIssue({ code: 'custom', path: ['answers'], message: 'Số câu trả lời không đúng' });
    }
  });
export type SaveAssessmentInput = z.infer<typeof saveAssessmentSchema>;

export const setSharedSchema = z.object({ shared: z.boolean() });
export type SetSharedInput = z.infer<typeof setSharedSchema>;

export interface AssessmentResultDto extends AssessmentScore {
  id: string;
  kind: AssessmentKind;
  shared: boolean;
  createdAt: string;
}

// ---------- Nhật ký tâm trạng ----------

export const MOOD_LABELS = ['Rất tệ', 'Tệ', 'Bình thường', 'Tốt', 'Rất tốt'] as const;

export const moodInputSchema = z.object({
  mood: z.number().int().min(1).max(5),
  note: z.string().trim().max(500).optional(),
  shared: z.boolean().default(false),
});
export type MoodInput = z.infer<typeof moodInputSchema>;

export interface MoodEntryDto {
  id: string;
  mood: number;
  note: string | null;
  shared: boolean;
  createdAt: string;
}

// ---------- Bài tập giữa các buổi ----------

export const homeworkInputSchema = z.object({
  title: z.string().trim().min(2, 'Vui lòng nhập tiêu đề').max(120),
  instructions: z.string().trim().max(2000).default(''),
  dueDate: z.iso.date().optional(),
});
export type HomeworkInput = z.infer<typeof homeworkInputSchema>;

export const homeworkSubmitSchema = z.object({ response: z.string().trim().min(1, 'Vui lòng nhập nội dung').max(4000) });
export type HomeworkSubmitInput = z.infer<typeof homeworkSubmitSchema>;

export interface HomeworkDto {
  id: string;
  caseId: string;
  title: string;
  instructions: string;
  dueDate: string | null;
  response: string | null;
  submittedAt: string | null;
  createdAt: string;
}

// ---------- Ghi chú buổi (riêng tư của chuyên gia) ----------

export const sessionNoteSchema = z.object({
  body: z.string().trim().min(1, 'Ghi chú trống').max(5000),
  appointmentId: z.uuid().optional(),
});
export type SessionNoteInput = z.infer<typeof sessionNoteSchema>;

export const updateSessionNoteSchema = z.object({ body: z.string().trim().min(1, 'Ghi chú trống').max(5000) });
export type UpdateSessionNoteInput = z.infer<typeof updateSessionNoteSchema>;

export interface SessionNoteDto {
  id: string;
  caseId: string;
  appointmentId: string | null;
  body: string;
  createdAt: string;
  updatedAt: string;
}

// ---------- Đánh giá chuyên gia ----------

export const REVIEW_STATUSES = ['pending', 'published', 'hidden'] as const;
export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const reviewInputSchema = z.object({
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).default(''),
});
export type ReviewInput = z.infer<typeof reviewInputSchema>;

export const moderateReviewSchema = z.object({ status: z.enum(['published', 'hidden']) });
export type ModerateReviewInput = z.infer<typeof moderateReviewSchema>;

/** Đánh giá công khai: cố ý không có tên khách (dữ liệu nhạy cảm). */
export interface PublicReview {
  id: string;
  rating: number;
  comment: string;
  createdAt: string;
}

// ---------- Thông báo ----------

export interface NotificationDto {
  id: string;
  type: string;
  title: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

export const markReadSchema = z.object({
  ids: z.array(z.uuid()).max(100).optional(),
  all: z.boolean().optional(),
});
export type MarkReadInput = z.infer<typeof markReadSchema>;

// ---------- Quên mật khẩu ----------

export const forgotPasswordSchema = z.object({ email: emailSchema });
export type ForgotPasswordInput = z.infer<typeof forgotPasswordSchema>;

export const resetPasswordSchema = z.object({
  token: z.string().min(20).max(200),
  newPassword: passwordSchema,
});
export type ResetPasswordInput = z.infer<typeof resetPasswordSchema>;

// ---------- Tìm chuyên gia ----------

export const EXPERT_SORTS = ['name', 'soonest', 'rating'] as const;
export type ExpertSort = (typeof EXPERT_SORTS)[number];

export const expertQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  specialty: z.string().trim().max(60).optional(),
  mode: z.enum(SESSION_MODES).optional(),
  language: z.string().trim().max(20).optional(),
  /** Chỉ giữ chuyên gia có phí đã công bố và không vượt mức này. Chuyên gia chưa công bố phí bị loại. */
  maxFee: z.coerce.number().int().min(0).max(100_000_000).optional(),
  sort: z.enum(EXPERT_SORTS).default('name'),
});
export type ExpertQuery = z.infer<typeof expertQuerySchema>;

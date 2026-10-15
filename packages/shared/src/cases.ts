import { z } from 'zod';
import type { Role } from './auth.js';

export const CASE_STATUSES = ['submitted', 'approved', 'rejected', 'assigned', 'contacted', 'in_treatment', 'closed'] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const RISK_LEVELS = ['none', 'elevated', 'urgent'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

/** Ca dang mo: khach khong duoc gui them bai sang loc moi. */
export const OPEN_CASE_STATUSES: readonly CaseStatus[] = ['submitted', 'approved', 'assigned', 'contacted', 'in_treatment'];
/** Trang thai ma chuyen gia duoc phan con quyen xem ca. */
export const EXPERT_VISIBLE_STATUSES: readonly CaseStatus[] = ['assigned', 'contacted', 'in_treatment', 'closed'];
/** Trang thai cho phep khach va chuyen gia nhan tin. */
export const CHAT_OPEN_STATUSES: readonly CaseStatus[] = ['assigned', 'contacted', 'in_treatment'];

export const CASE_STATUS_LABELS: Record<CaseStatus, string> = {
  submitted: 'Chờ duyệt',
  approved: 'Đã duyệt, chờ phân công',
  rejected: 'Chưa phù hợp',
  assigned: 'Đã phân chuyên gia',
  contacted: 'Đã liên hệ',
  in_treatment: 'Đang trị liệu',
  closed: 'Đã kết thúc',
};

export const RISK_LABELS: Record<RiskLevel, string> = {
  none: 'Bình thường',
  elevated: 'Cần lưu ý',
  urgent: 'Khẩn cấp',
};

export interface TransitionRule {
  to: CaseStatus;
  roles: readonly Role[];
}

/** Nguon su that duy nhat cho cac buoc chuyen trang thai hop le va ai duoc thuc hien. May chu luon kiem tra lai. */
export const CASE_TRANSITIONS: Record<CaseStatus, readonly TransitionRule[]> = {
  submitted: [
    { to: 'approved', roles: ['admin'] },
    { to: 'rejected', roles: ['admin'] },
  ],
  approved: [
    { to: 'assigned', roles: ['admin'] },
    { to: 'closed', roles: ['admin'] },
  ],
  rejected: [],
  assigned: [
    { to: 'assigned', roles: ['admin'] }, // doi chuyen gia
    { to: 'contacted', roles: ['expert', 'admin'] },
    { to: 'approved', roles: ['expert', 'admin'] }, // chuyen gia tu choi / admin thu hoi phan cong
    { to: 'closed', roles: ['admin'] },
  ],
  contacted: [
    { to: 'in_treatment', roles: ['expert', 'admin'] },
    { to: 'closed', roles: ['expert', 'admin'] },
  ],
  in_treatment: [{ to: 'closed', roles: ['expert', 'admin'] }],
  closed: [],
};

export function transitionExists(from: CaseStatus, to: CaseStatus): boolean {
  return CASE_TRANSITIONS[from].some((r) => r.to === to);
}

export function canTransition(from: CaseStatus, to: CaseStatus, role: Role): boolean {
  return CASE_TRANSITIONS[from].some((r) => r.to === to && r.roles.includes(role));
}

// ---------- Cau hoi sang loc ----------

export const QUESTION_TYPES = ['single', 'multi', 'text'] as const;
export type QuestionType = (typeof QUESTION_TYPES)[number];

export const optionSchema = z.object({
  value: z.string().trim().min(1).max(100),
  label: z.string().trim().min(1).max(300),
  /** Chon dap an nay se nang muc nguy co cua ca. Chi quan tri vien nhin thay. */
  risk: z.enum(['elevated', 'urgent']).optional(),
  /** Slug linh vuc chuyen mon dap an nay goi y. Dung de goi y chuyen gia. */
  specialties: z.array(z.string().trim().min(1).max(60)).max(10).optional(),
});
export type QuestionOption = z.infer<typeof optionSchema>;

export const questionInputSchema = z
  .object({
    prompt: z.string().trim().min(3).max(500),
    helpText: z.string().trim().max(500).nullish(),
    type: z.enum(QUESTION_TYPES),
    options: z.array(optionSchema).max(20).default([]),
    required: z.boolean().default(true),
    active: z.boolean().default(true),
    position: z.number().int().min(0).max(1000),
  })
  .refine((q) => q.type === 'text' || q.options.length >= 2, {
    message: 'Câu hỏi chọn đáp án cần ít nhất 2 lựa chọn',
    path: ['options'],
  })
  .refine((q) => new Set(q.options.map((o) => o.value)).size === q.options.length, {
    message: 'Giá trị các lựa chọn không được trùng nhau',
    path: ['options'],
  });
export type QuestionInput = z.infer<typeof questionInputSchema>;

/** Cau hoi gui cho khach: da loai bo co nguy co va goi y chuyen mon. */
export interface PublicQuestion {
  id: string;
  position: number;
  prompt: string;
  helpText: string | null;
  type: QuestionType;
  required: boolean;
  options: { value: string; label: string }[];
}

// ---------- Gui bai sang loc ----------

export const PREFERRED_MODES = ['online', 'in_person', 'any'] as const;
export type PreferredMode = (typeof PREFERRED_MODES)[number];

export const submitScreeningSchema = z.object({
  answers: z
    .array(
      z.object({
        questionId: z.uuid(),
        value: z.union([z.string().max(2000), z.array(z.string().max(100)).max(20)]),
      }),
    )
    .max(50),
  concerns: z.string().trim().max(2000).default(''),
  preferredMode: z.enum(PREFERRED_MODES).default('any'),
});
export type SubmitScreeningInput = z.infer<typeof submitScreeningSchema>;

/** Anh chup cau tra loi luu cung ca (khong doi khi admin sua cau hoi sau nay). */
export interface AnswerSnapshot {
  questionId: string;
  prompt: string;
  type: QuestionType;
  values: string[];
  labels: string[];
  text?: string;
  risk?: 'elevated' | 'urgent';
  specialties: string[];
}

export const transitionSchema = z.object({
  to: z.enum(CASE_STATUSES),
  note: z.string().trim().max(1000).optional(),
  expertId: z.uuid().optional(),
});
export type TransitionInput = z.infer<typeof transitionSchema>;

export const adminNoteSchema = z.object({ note: z.string().trim().max(2000) });

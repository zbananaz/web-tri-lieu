import { z } from 'zod';
import { SESSION_MODES } from './experts.js';

export const APPOINTMENT_STATUSES = ['requested', 'confirmed', 'cancelled', 'completed'] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

export const APPOINTMENT_STATUS_LABELS: Record<AppointmentStatus, string> = {
  requested: 'Chờ chuyên gia xác nhận',
  confirmed: 'Đã xác nhận',
  cancelled: 'Đã hủy',
  completed: 'Đã hoàn thành',
};

/** Chi cho phep lien ket http(s): chan javascript:, data: ... trong link phong hop. */
export const httpUrlSchema = z
  .url()
  .max(500)
  .refine((u) => /^https?:\/\//i.test(u), 'Liên kết phải bắt đầu bằng http hoặc https');

export const bookAppointmentSchema = z.object({
  startsAt: z.iso.datetime(),
  mode: z.enum(SESSION_MODES),
  note: z.string().trim().max(500).optional(),
});
export type BookAppointmentInput = z.infer<typeof bookAppointmentSchema>;

export const confirmAppointmentSchema = z.object({ meetingLink: httpUrlSchema.optional() });
export type ConfirmAppointmentInput = z.infer<typeof confirmAppointmentSchema>;

export const cancelAppointmentSchema = z.object({ reason: z.string().trim().max(500).optional() });
export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const sendMessageSchema = z.object({ body: z.string().trim().min(1, 'Tin nhắn trống').max(4000) });
export type SendMessageInput = z.infer<typeof sendMessageSchema>;

export interface ChatMessage {
  id: string;
  caseId: string;
  senderId: string;
  body: string;
  createdAt: string;
  readAt: string | null;
}

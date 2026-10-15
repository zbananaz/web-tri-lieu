import { z } from 'zod';

export const ROLES = ['client', 'expert', 'admin'] as const;
export type Role = (typeof ROLES)[number];

export const emailSchema = z.email('Email không hợp lệ').trim().toLowerCase().max(254);

export const passwordSchema = z
  .string()
  .min(8, 'Mật khẩu tối thiểu 8 ký tự')
  .max(128, 'Mật khẩu tối đa 128 ký tự')
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), 'Mật khẩu cần có cả chữ và số');

export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[0-9+\s().-]{8,20}$/, 'Số điện thoại không hợp lệ');

export const registerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2, 'Vui lòng nhập họ tên').max(100),
  phone: phoneSchema.optional(),
});
export type RegisterInput = z.infer<typeof registerSchema>;

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(128),
  newPassword: passwordSchema,
});
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

export interface AuthUser {
  id: string;
  email: string;
  role: Role;
  fullName: string;
  /** Mat khau tam do quan tri cap: moi thao tac khac bi chan cho den khi doi mat khau. */
  mustChangePassword?: boolean;
}

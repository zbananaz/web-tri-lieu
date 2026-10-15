import { z } from 'zod';
import { emailSchema, passwordSchema, phoneSchema } from './auth.js';

export const SESSION_MODES = ['online', 'in_person'] as const;
export type SessionMode = (typeof SESSION_MODES)[number];

export const expertProfileSchema = z.object({
  headline: z.string().trim().max(160).default(''),
  bio: z.string().trim().max(4000).default(''),
  avatarUrl: z.url().max(500).nullish(),
  credentials: z.string().trim().max(1000).default(''),
  yearsExperience: z.number().int().min(0).max(70).default(0),
  languages: z.array(z.string().trim().min(2).max(20)).max(10).default(['vi']),
  modes: z.array(z.enum(SESSION_MODES)).min(1).default(['online']),
  feeVnd: z.number().int().min(0).max(100_000_000).nullish(),
  sessionMinutes: z.number().int().min(15).max(180).default(50),
  specialtySlugs: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
});
export type ExpertProfileInput = z.infer<typeof expertProfileSchema>;

export const updateExpertProfileSchema = expertProfileSchema.partial();
export type UpdateExpertProfileInput = z.infer<typeof updateExpertProfileSchema>;

export const createExpertSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  fullName: z.string().trim().min(2).max(100),
  phone: phoneSchema.optional(),
  profile: expertProfileSchema.default(() => expertProfileSchema.parse({})),
});
export type CreateExpertInput = z.infer<typeof createExpertSchema>;

export const adminUpdateExpertSchema = updateExpertProfileSchema.extend({ active: z.boolean().optional() });
export type AdminUpdateExpertInput = z.infer<typeof adminUpdateExpertSchema>;

/** Ho so cong khai: khong co email, so dien thoai. */
export interface PublicExpert {
  id: string;
  fullName: string;
  headline: string;
  bio: string;
  avatarUrl: string | null;
  credentials: string;
  yearsExperience: number;
  languages: string[];
  modes: string[];
  feeVnd: number | null;
  sessionMinutes: number;
  specialties: { slug: string; name: string }[];
}

export const availabilitySlotSchema = z
  .object({
    weekday: z.number().int().min(0).max(6),
    startMinute: z.number().int().min(0).max(1439),
    endMinute: z.number().int().min(1).max(1440),
  })
  .refine((s) => s.startMinute < s.endMinute, { message: 'Giờ kết thúc phải sau giờ bắt đầu', path: ['endMinute'] });
export const setAvailabilitySchema = z.object({ slots: z.array(availabilitySlotSchema).max(100) });
export type AvailabilitySlot = z.infer<typeof availabilitySlotSchema>;

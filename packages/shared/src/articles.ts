import { z } from 'zod';
import { httpUrlSchema } from './appointments.js';

export const ARTICLE_STATUSES = ['draft', 'published'] as const;
export type ArticleStatus = (typeof ARTICLE_STATUSES)[number];

export const tagSchema = z.string().trim().min(1).max(30);

export const articleInputSchema = z.object({
  title: z.string().trim().min(3, 'Tiêu đề quá ngắn').max(200),
  excerpt: z.string().trim().max(400).default(''),
  /** HTML tho tu trinh soan thao; may chu luon lam sach lai truoc khi luu. */
  contentHtml: z.string().min(1, 'Nội dung trống').max(200_000),
  coverUrl: httpUrlSchema.nullish(),
  tags: z.array(tagSchema).max(8).default([]),
  slug: z
    .string()
    .trim()
    .toLowerCase()
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Đường dẫn chỉ gồm chữ thường, số và dấu gạch ngang')
    .max(120)
    .optional(),
});
export type ArticleInput = z.infer<typeof articleInputSchema>;

export interface ArticleSummary {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  tags: string[];
  status: ArticleStatus;
  publishedAt: string | null;
  authorName: string;
}
export interface ArticleDetail extends ArticleSummary {
  contentHtml: string;
}

/** Tao slug khong dau tu tieu de tieng Viet. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}

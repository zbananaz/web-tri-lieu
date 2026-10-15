import { ConflictException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import { type ArticleDetail, type ArticleInput, type ArticleSummary, slugify } from '@wtl/shared';
import { and, count, desc, eq, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { articles, users } from '../db/schema.js';
import { sanitizeArticleHtml } from './sanitize.js';

const pgCode = (e: unknown): string | undefined =>
  (e as { code?: string })?.code ?? (e as { cause?: { code?: string } })?.cause?.code;

const summaryCols = {
  id: articles.id,
  slug: articles.slug,
  title: articles.title,
  excerpt: articles.excerpt,
  coverUrl: articles.coverUrl,
  tags: articles.tags,
  status: articles.status,
  publishedAt: articles.publishedAt,
  authorName: users.fullName,
};

type Row = {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverUrl: string | null;
  tags: string[];
  status: 'draft' | 'published';
  publishedAt: Date | null;
  authorName: string;
};

const toSummary = (r: Row): ArticleSummary => ({ ...r, publishedAt: r.publishedAt?.toISOString() ?? null });

@Injectable()
export class ArticlesService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  // ---------- Cong khai: chi bai da xuat ban ----------

  async listPublic(page: number, pageSize: number, tag?: string) {
    const where = and(eq(articles.status, 'published'), tag ? sql`${tag} = ANY(${articles.tags})` : undefined);
    const rows = await this.db
      .select(summaryCols)
      .from(articles)
      .innerJoin(users, eq(users.id, articles.authorId))
      .where(where)
      .orderBy(desc(articles.publishedAt))
      .limit(pageSize)
      .offset((page - 1) * pageSize);
    const totals = await this.db.select({ n: count() }).from(articles).where(where);
    return { articles: rows.map(toSummary), total: Number(totals[0]?.n ?? 0), page, pageSize };
  }

  async getPublic(slug: string): Promise<ArticleDetail> {
    const [r] = await this.db
      .select({ ...summaryCols, contentHtml: articles.contentHtml })
      .from(articles)
      .innerJoin(users, eq(users.id, articles.authorId))
      .where(and(eq(articles.slug, slug), eq(articles.status, 'published')))
      .limit(1);
    if (!r) throw new NotFoundException('Không tìm thấy bài viết');
    return { ...toSummary(r), contentHtml: r.contentHtml };
  }

  // ---------- Quan tri ----------

  async listAdmin() {
    const rows = await this.db
      .select(summaryCols)
      .from(articles)
      .innerJoin(users, eq(users.id, articles.authorId))
      .orderBy(desc(articles.updatedAt))
      .limit(500);
    return rows.map(toSummary);
  }

  async getAdmin(id: string): Promise<ArticleDetail> {
    const [r] = await this.db
      .select({ ...summaryCols, contentHtml: articles.contentHtml })
      .from(articles)
      .innerJoin(users, eq(users.id, articles.authorId))
      .where(eq(articles.id, id))
      .limit(1);
    if (!r) throw new NotFoundException('Không tìm thấy bài viết');
    return { ...toSummary(r), contentHtml: r.contentHtml };
  }

  private async uniqueSlug(base: string): Promise<string> {
    const root = base || 'bai-viet';
    for (let i = 1; i < 50; i++) {
      const candidate = i === 1 ? root : `${root}-${i}`;
      const [hit] = await this.db.select({ id: articles.id }).from(articles).where(eq(articles.slug, candidate)).limit(1);
      if (!hit) return candidate;
    }
    throw new ConflictException('Không tạo được đường dẫn duy nhất');
  }

  async create(authorId: string, input: ArticleInput, ip?: string | null) {
    const slug = input.slug ?? (await this.uniqueSlug(slugify(input.title)));
    try {
      const [row] = await this.db
        .insert(articles)
        .values({
          slug,
          title: input.title,
          excerpt: input.excerpt,
          contentHtml: sanitizeArticleHtml(input.contentHtml),
          coverUrl: input.coverUrl ?? null,
          tags: [...new Set(input.tags)],
          authorId,
        })
        .returning({ id: articles.id });
      await this.audit.log({ actorId: authorId, action: 'article.create', entity: 'article', entityId: row!.id, ip });
      return this.getAdmin(row!.id);
    } catch (e) {
      if (pgCode(e) === '23505') throw new ConflictException('Đường dẫn đã tồn tại');
      throw e;
    }
  }

  async update(actorId: string, id: string, input: ArticleInput, ip?: string | null) {
    const current = await this.getAdmin(id);
    try {
      await this.db
        .update(articles)
        .set({
          slug: input.slug ?? current.slug,
          title: input.title,
          excerpt: input.excerpt,
          contentHtml: sanitizeArticleHtml(input.contentHtml),
          coverUrl: input.coverUrl ?? null,
          tags: [...new Set(input.tags)],
          updatedAt: new Date(),
        })
        .where(eq(articles.id, id));
    } catch (e) {
      if (pgCode(e) === '23505') throw new ConflictException('Đường dẫn đã tồn tại');
      throw e;
    }
    await this.audit.log({ actorId, action: 'article.update', entity: 'article', entityId: id, ip });
    return this.getAdmin(id);
  }

  async setPublished(actorId: string, id: string, published: boolean, ip?: string | null) {
    const current = await this.getAdmin(id);
    await this.db
      .update(articles)
      .set({
        status: published ? 'published' : 'draft',
        // Giu ngay xuat ban dau tien khi bat/tat lai
        publishedAt: published ? (current.publishedAt ? new Date(current.publishedAt) : new Date()) : current.publishedAt ? new Date(current.publishedAt) : null,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, id));
    await this.audit.log({
      actorId,
      action: published ? 'article.publish' : 'article.unpublish',
      entity: 'article',
      entityId: id,
      ip,
    });
    return this.getAdmin(id);
  }

  async remove(actorId: string, id: string, ip?: string | null) {
    await this.getAdmin(id);
    await this.db.delete(articles).where(eq(articles.id, id));
    await this.audit.log({ actorId, action: 'article.delete', entity: 'article', entityId: id, ip });
    return { id };
  }
}

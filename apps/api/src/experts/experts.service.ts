import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminUpdateExpertInput, CreateExpertInput, ExpertQuery, PublicExpert, UpdateExpertProfileInput } from '@wtl/shared';
import { and, eq, gt, inArray, sql } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { hashPassword } from '../auth/password.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { MIN_LEAD_MINUTES, computeSlots } from '../appointments/slots.js';
import { appointments, expertAvailability, expertProfiles, expertSpecialties, reviews, specialties, users } from '../db/schema.js';

const NEXT_SLOT_DAYS = 14;

type ProfileRow = typeof expertProfiles.$inferSelect;

@Injectable()
export class ExpertsService {
  constructor(
    @Inject(DB) private readonly db: Db,
    private readonly audit: AuditService,
  ) {}

  listSpecialties() {
    return this.db.select().from(specialties).orderBy(specialties.name);
  }

  private async specialtyMap(expertIds: string[]): Promise<Map<string, { slug: string; name: string }[]>> {
    const map = new Map<string, { slug: string; name: string }[]>();
    if (expertIds.length === 0) return map;
    const rows = await this.db
      .select({ expertId: expertSpecialties.expertId, slug: specialties.slug, name: specialties.name })
      .from(expertSpecialties)
      .innerJoin(specialties, eq(specialties.id, expertSpecialties.specialtyId))
      .where(inArray(expertSpecialties.expertId, expertIds));
    for (const r of rows) {
      const list = map.get(r.expertId) ?? [];
      list.push({ slug: r.slug, name: r.name });
      map.set(r.expertId, list);
    }
    return map;
  }

  /** Diem trung binh danh gia DA DUYET (mot truy van cho ca danh sach). */
  private async ratingMap(expertIds: string[]): Promise<Map<string, { avg: number; count: number }>> {
    const map = new Map<string, { avg: number; count: number }>();
    if (expertIds.length === 0) return map;
    const rows = await this.db
      .select({
        expertId: reviews.expertId,
        avg: sql<number>`round(avg(${reviews.rating})::numeric, 1)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(reviews)
      .where(and(inArray(reviews.expertId, expertIds), eq(reviews.status, 'published')))
      .groupBy(reviews.expertId);
    for (const r of rows) map.set(r.expertId, { avg: r.avg, count: r.count });
    return map;
  }

  /** Gio trong gan nhat trong NEXT_SLOT_DAYS ngay: 2 truy van chung cho ca danh sach, khong truy van theo tung nguoi. */
  private async nextSlotMap(profiles: { id: string; sessionMinutes: number }[]): Promise<Map<string, Date>> {
    const map = new Map<string, Date>();
    if (profiles.length === 0) return map;
    const ids = profiles.map((p) => p.id);
    const now = new Date();
    const windows = await this.db.select().from(expertAvailability).where(inArray(expertAvailability.expertId, ids));
    const busy = await this.db
      .select({ expertId: appointments.expertId, start: appointments.startsAt, end: appointments.endsAt })
      .from(appointments)
      .where(and(inArray(appointments.expertId, ids), inArray(appointments.status, ['requested', 'confirmed']), gt(appointments.endsAt, now)));
    for (const p of profiles) {
      const slots = computeSlots({
        windows: windows.filter((w) => w.expertId === p.id),
        sessionMinutes: p.sessionMinutes,
        busy: busy.filter((b) => b.expertId === p.id),
        now,
        days: NEXT_SLOT_DAYS,
        minLeadMinutes: MIN_LEAD_MINUTES,
      });
      if (slots[0]) map.set(p.id, slots[0]);
    }
    return map;
  }

  private toPublic(
    user: { id: string; fullName: string },
    p: ProfileRow,
    specs: { slug: string; name: string }[] | undefined,
    extra: { rating?: { avg: number; count: number }; nextSlot?: Date } = {},
  ): PublicExpert {
    return {
      id: user.id,
      fullName: user.fullName,
      headline: p.headline,
      bio: p.bio,
      avatarUrl: p.avatarUrl,
      credentials: p.credentials,
      yearsExperience: p.yearsExperience,
      languages: p.languages,
      modes: p.modes,
      feeVnd: p.feeVnd,
      sessionMinutes: p.sessionMinutes,
      specialties: specs ?? [],
      rating: extra.rating ?? null,
      nextSlot: extra.nextSlot?.toISOString() ?? null,
    };
  }

  /**
   * Danh sach cong khai: chi chuyen gia dang hoat dong. Khong lo email/SDT.
   * Loc (ten, chuyen mon, hinh thuc, ngon ngu, muc phi toi da) va sap xep (ten, gio trong som nhat, danh gia) o may chu.
   * `maxFee`: chuyen gia chua cong bo phi bi loai khi co loc phi.
   */
  async listPublic(query: Partial<ExpertQuery> = {}): Promise<PublicExpert[]> {
    const rows = await this.db
      .select({ user: { id: users.id, fullName: users.fullName }, profile: expertProfiles })
      .from(expertProfiles)
      .innerJoin(users, eq(users.id, expertProfiles.userId))
      .where(and(eq(expertProfiles.active, true), eq(users.status, 'active'), eq(users.role, 'expert')))
      .orderBy(users.fullName);
    const ids = rows.map((r) => r.user.id);
    const [specs, ratings, slots] = await Promise.all([
      this.specialtyMap(ids),
      this.ratingMap(ids),
      this.nextSlotMap(rows.map((r) => ({ id: r.user.id, sessionMinutes: r.profile.sessionMinutes }))),
    ]);
    const q = query.q?.toLowerCase();
    const lang = query.language?.toLowerCase();
    const list = rows
      .filter((r) => {
        const sp = specs.get(r.user.id) ?? [];
        if (q && !`${r.user.fullName} ${r.profile.headline} ${r.profile.bio} ${sp.map((s) => s.name).join(' ')}`.toLowerCase().includes(q)) return false;
        if (query.specialty && !sp.some((s) => s.slug === query.specialty)) return false;
        if (query.mode && !r.profile.modes.includes(query.mode)) return false;
        if (lang && !r.profile.languages.some((l) => l.toLowerCase() === lang)) return false;
        if (query.maxFee !== undefined && (r.profile.feeVnd === null || r.profile.feeVnd > query.maxFee)) return false;
        return true;
      })
      .map((r) => this.toPublic(r.user, r.profile, specs.get(r.user.id), { rating: ratings.get(r.user.id), nextSlot: slots.get(r.user.id) }));
    if (query.sort === 'soonest') {
      list.sort((a, b) => (a.nextSlot ?? '9').localeCompare(b.nextSlot ?? '9') || a.fullName.localeCompare(b.fullName, 'vi'));
    } else if (query.sort === 'rating') {
      list.sort((a, b) => (b.rating?.avg ?? 0) - (a.rating?.avg ?? 0) || (b.rating?.count ?? 0) - (a.rating?.count ?? 0));
    }
    return list;
  }

  async getPublic(id: string): Promise<PublicExpert> {
    const list = await this.listPublic();
    const found = list.find((e) => e.id === id);
    if (!found) throw new NotFoundException('Không tìm thấy chuyên gia');
    return found;
  }

  /** Cho admin: gom ca chuyen gia dang tam ngung va thong tin lien he. */
  async listForAdmin() {
    const rows = await this.db
      .select({
        user: { id: users.id, fullName: users.fullName, email: users.email, phone: users.phone, status: users.status },
        profile: expertProfiles,
      })
      .from(expertProfiles)
      .innerJoin(users, eq(users.id, expertProfiles.userId))
      .orderBy(users.fullName);
    const specs = await this.specialtyMap(rows.map((r) => r.user.id));
    return rows.map((r) => ({
      ...this.toPublic(r.user, r.profile, specs.get(r.user.id)),
      email: r.user.email,
      phone: r.user.phone,
      active: r.profile.active && r.user.status === 'active',
    }));
  }

  private async resolveSpecialtyIds(slugs: string[]): Promise<number[]> {
    if (slugs.length === 0) return [];
    const rows = await this.db.select().from(specialties).where(inArray(specialties.slug, slugs));
    if (rows.length !== new Set(slugs).size) throw new BadRequestException('Có lĩnh vực chuyên môn không tồn tại');
    return rows.map((r) => r.id);
  }

  async create(input: CreateExpertInput, actorId: string, ip?: string | null) {
    const [exists] = await this.db.select({ id: users.id }).from(users).where(eq(users.email, input.email)).limit(1);
    if (exists) throw new BadRequestException('Email này đã được sử dụng');
    const specialtyIds = await this.resolveSpecialtyIds(input.profile.specialtySlugs);
    const passwordHash = await hashPassword(input.password);
    const id = await this.db.transaction(async (tx) => {
      const [u] = await tx
        .insert(users)
        .values({ email: input.email, passwordHash, role: 'expert', fullName: input.fullName, phone: input.phone ?? null })
        .returning({ id: users.id });
      const { specialtySlugs: _slugs, ...profile } = input.profile;
      await tx.insert(expertProfiles).values({ userId: u!.id, ...profile, avatarUrl: profile.avatarUrl ?? null, feeVnd: profile.feeVnd ?? null });
      if (specialtyIds.length) {
        await tx.insert(expertSpecialties).values(specialtyIds.map((specialtyId) => ({ expertId: u!.id, specialtyId })));
      }
      return u!.id;
    });
    await this.audit.log({ actorId, action: 'expert.create', entity: 'user', entityId: id, ip });
    return { id };
  }

  async updateProfile(
    expertId: string,
    input: UpdateExpertProfileInput | AdminUpdateExpertInput,
    actorId: string,
    ip?: string | null,
  ) {
    const { specialtySlugs, ...fields } = input;
    const specialtyIds = specialtySlugs ? await this.resolveSpecialtyIds(specialtySlugs) : null;
    await this.db.transaction(async (tx) => {
      const [existing] = await tx.select({ userId: expertProfiles.userId }).from(expertProfiles).where(eq(expertProfiles.userId, expertId)).limit(1);
      if (!existing) throw new NotFoundException('Không tìm thấy chuyên gia');
      const set = Object.fromEntries(Object.entries(fields).filter(([, v]) => v !== undefined));
      if (Object.keys(set).length) await tx.update(expertProfiles).set({ ...set, updatedAt: new Date() }).where(eq(expertProfiles.userId, expertId));
      if (specialtyIds) {
        await tx.delete(expertSpecialties).where(eq(expertSpecialties.expertId, expertId));
        if (specialtyIds.length) {
          await tx.insert(expertSpecialties).values(specialtyIds.map((specialtyId) => ({ expertId, specialtyId })));
        }
      }
    });
    await this.audit.log({ actorId, action: 'expert.update', entity: 'user', entityId: expertId, ip });
  }

  async isActiveExpert(id: string): Promise<boolean> {
    const [row] = await this.db
      .select({ id: users.id })
      .from(users)
      .innerJoin(expertProfiles, eq(expertProfiles.userId, users.id))
      .where(and(eq(users.id, id), eq(users.role, 'expert'), eq(users.status, 'active'), eq(expertProfiles.active, true)))
      .limit(1);
    return !!row;
  }
}

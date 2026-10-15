import { BadRequestException, Inject, Injectable, NotFoundException } from '@nestjs/common';
import type { AdminUpdateExpertInput, CreateExpertInput, PublicExpert, UpdateExpertProfileInput } from '@wtl/shared';
import { and, eq, inArray } from 'drizzle-orm';
import { AuditService } from '../audit/audit.service.js';
import { hashPassword } from '../auth/password.js';
import type { Db } from '../db/client.js';
import { DB } from '../db/db.module.js';
import { expertProfiles, expertSpecialties, specialties, users } from '../db/schema.js';

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

  private toPublic(
    user: { id: string; fullName: string },
    p: ProfileRow,
    specs: { slug: string; name: string }[] | undefined,
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
    };
  }

  /** Danh sach cong khai: chi chuyen gia dang hoat dong. Khong lo email/SDT. */
  async listPublic(): Promise<PublicExpert[]> {
    const rows = await this.db
      .select({ user: { id: users.id, fullName: users.fullName }, profile: expertProfiles })
      .from(expertProfiles)
      .innerJoin(users, eq(users.id, expertProfiles.userId))
      .where(and(eq(expertProfiles.active, true), eq(users.status, 'active'), eq(users.role, 'expert')))
      .orderBy(users.fullName);
    const specs = await this.specialtyMap(rows.map((r) => r.user.id));
    return rows.map((r) => this.toPublic(r.user, r.profile, specs.get(r.user.id)));
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

import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  serial,
  smallint,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';

export const userRole = pgEnum('user_role', ['client', 'expert', 'admin']);
export const userStatus = pgEnum('user_status', ['active', 'disabled']);
export const caseStatus = pgEnum('case_status', [
  'submitted',
  'approved',
  'rejected',
  'assigned',
  'contacted',
  'in_treatment',
  'closed',
]);
export const riskLevel = pgEnum('risk_level', ['none', 'elevated', 'urgent']);
export const appointmentStatus = pgEnum('appointment_status', [
  'requested',
  'confirmed',
  'cancelled',
  'completed',
]);
export const articleStatus = pgEnum('article_status', ['draft', 'published']);
export const questionType = pgEnum('question_type', ['single', 'multi', 'text']);

const createdAt = () => timestamp('created_at', { withTimezone: true }).notNull().defaultNow();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: userRole('role').notNull().default('client'),
  status: userStatus('status').notNull().default('active'),
  fullName: text('full_name').notNull(),
  phone: text('phone'),
  failedLogins: integer('failed_logins').notNull().default(0),
  lockedUntil: timestamp('locked_until', { withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const sessions = pgTable(
  'sessions',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    tokenHash: text('token_hash').notNull().unique(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    lastUsedAt: timestamp('last_used_at', { withTimezone: true }).notNull().defaultNow(),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [index('sessions_user_idx').on(t.userId)],
);

export const specialties = pgTable('specialties', {
  id: serial('id').primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
});

export const expertProfiles = pgTable('expert_profiles', {
  userId: uuid('user_id')
    .primaryKey()
    .references(() => users.id, { onDelete: 'cascade' }),
  headline: text('headline').notNull().default(''),
  bio: text('bio').notNull().default(''),
  avatarUrl: text('avatar_url'),
  credentials: text('credentials').notNull().default(''),
  yearsExperience: integer('years_experience').notNull().default(0),
  languages: text('languages').array().notNull().default(sql`ARRAY['vi']::text[]`),
  modes: text('modes').array().notNull().default(sql`ARRAY['online']::text[]`),
  feeVnd: integer('fee_vnd'),
  sessionMinutes: integer('session_minutes').notNull().default(50),
  active: boolean('active').notNull().default(true),
  updatedAt: updatedAt(),
});

export const expertSpecialties = pgTable(
  'expert_specialties',
  {
    expertId: uuid('expert_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    specialtyId: integer('specialty_id')
      .notNull()
      .references(() => specialties.id, { onDelete: 'cascade' }),
  },
  (t) => [primaryKey({ columns: [t.expertId, t.specialtyId] })],
);

// Khung gio ranh theo tuan (gio dia phuong Asia/Ho_Chi_Minh, tinh bang phut ke tu 00:00).
export const expertAvailability = pgTable(
  'expert_availability',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    expertId: uuid('expert_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    weekday: smallint('weekday').notNull(), // 0 = Chu nhat ... 6 = Thu bay
    startMinute: smallint('start_minute').notNull(),
    endMinute: smallint('end_minute').notNull(),
  },
  (t) => [
    index('availability_expert_idx').on(t.expertId),
    check('availability_weekday_ck', sql`${t.weekday} between 0 and 6`),
    check('availability_range_ck', sql`${t.startMinute} >= 0 and ${t.endMinute} <= 1440 and ${t.startMinute} < ${t.endMinute}`),
  ],
);

// Option: { value: string; label: string; risk?: 'elevated' | 'urgent'; specialties?: string[] }
export const screeningQuestions = pgTable('screening_questions', {
  id: uuid('id').primaryKey().defaultRandom(),
  position: integer('position').notNull(),
  prompt: text('prompt').notNull(),
  helpText: text('help_text'),
  type: questionType('type').notNull(),
  options: jsonb('options').notNull().default(sql`'[]'::jsonb`),
  required: boolean('required').notNull().default(true),
  active: boolean('active').notNull().default(true),
  createdAt: createdAt(),
  updatedAt: updatedAt(),
});

export const cases = pgTable(
  'cases',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id),
    status: caseStatus('status').notNull().default('submitted'),
    riskLevel: riskLevel('risk_level').notNull().default('none'),
    // Anh chup cau hoi + tra loi tai thoi diem gui: [{ questionId, prompt, answer: string | string[] }]
    answers: jsonb('answers').notNull(),
    concerns: text('concerns').notNull().default(''),
    preferredMode: text('preferred_mode'),
    assignedExpertId: uuid('assigned_expert_id').references(() => users.id),
    rejectionReason: text('rejection_reason'),
    adminNote: text('admin_note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
    approvedAt: timestamp('approved_at', { withTimezone: true }),
    assignedAt: timestamp('assigned_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
  },
  (t) => [
    index('cases_client_idx').on(t.clientId),
    index('cases_expert_idx').on(t.assignedExpertId),
    index('cases_status_idx').on(t.status),
  ],
);

export const caseEvents = pgTable(
  'case_events',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    actorId: uuid('actor_id').references(() => users.id),
    fromStatus: caseStatus('from_status'),
    toStatus: caseStatus('to_status').notNull(),
    note: text('note'),
    createdAt: createdAt(),
  },
  (t) => [index('case_events_case_idx').on(t.caseId)],
);

// Rang buoc chong trung lich (EXCLUDE ... tstzrange) nam trong migration SQL tuy chinh.
export const appointments = pgTable(
  'appointments',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    expertId: uuid('expert_id')
      .notNull()
      .references(() => users.id),
    clientId: uuid('client_id')
      .notNull()
      .references(() => users.id),
    startsAt: timestamp('starts_at', { withTimezone: true }).notNull(),
    endsAt: timestamp('ends_at', { withTimezone: true }).notNull(),
    status: appointmentStatus('status').notNull().default('requested'),
    mode: text('mode').notNull().default('online'),
    meetingLink: text('meeting_link'),
    note: text('note'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('appointments_expert_idx').on(t.expertId, t.startsAt),
    index('appointments_client_idx').on(t.clientId, t.startsAt),
    check('appointments_range_ck', sql`${t.startsAt} < ${t.endsAt}`),
  ],
);

export const messages = pgTable(
  'messages',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    caseId: uuid('case_id')
      .notNull()
      .references(() => cases.id, { onDelete: 'cascade' }),
    senderId: uuid('sender_id')
      .notNull()
      .references(() => users.id),
    body: text('body').notNull(),
    createdAt: createdAt(),
    readAt: timestamp('read_at', { withTimezone: true }),
  },
  (t) => [index('messages_case_idx').on(t.caseId, t.createdAt)],
);

export const articles = pgTable(
  'articles',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    slug: text('slug').notNull().unique(),
    title: text('title').notNull(),
    excerpt: text('excerpt').notNull().default(''),
    contentHtml: text('content_html').notNull(), // da lam sach o may chu truoc khi luu
    coverUrl: text('cover_url'),
    tags: text('tags').array().notNull().default(sql`ARRAY[]::text[]`),
    status: articleStatus('status').notNull().default('draft'),
    authorId: uuid('author_id')
      .notNull()
      .references(() => users.id),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('articles_status_idx').on(t.status, t.publishedAt)],
);

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    actorId: uuid('actor_id').references(() => users.id),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entity_id'),
    ip: text('ip'),
    meta: jsonb('meta'),
    createdAt: createdAt(),
  },
  (t) => [index('audit_entity_idx').on(t.entity, t.entityId), index('audit_actor_idx').on(t.actorId)],
);

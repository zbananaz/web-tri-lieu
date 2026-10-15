CREATE TYPE "public"."appointment_status" AS ENUM('requested', 'confirmed', 'cancelled', 'completed');--> statement-breakpoint
CREATE TYPE "public"."article_status" AS ENUM('draft', 'published');--> statement-breakpoint
CREATE TYPE "public"."case_status" AS ENUM('submitted', 'approved', 'rejected', 'assigned', 'contacted', 'in_treatment', 'closed');--> statement-breakpoint
CREATE TYPE "public"."question_type" AS ENUM('single', 'multi', 'text');--> statement-breakpoint
CREATE TYPE "public"."risk_level" AS ENUM('none', 'elevated', 'urgent');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('client', 'expert', 'admin');--> statement-breakpoint
CREATE TYPE "public"."user_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TABLE "appointments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"expert_id" uuid NOT NULL,
	"client_id" uuid NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"status" "appointment_status" DEFAULT 'requested' NOT NULL,
	"mode" text DEFAULT 'online' NOT NULL,
	"meeting_link" text,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "appointments_range_ck" CHECK ("appointments"."starts_at" < "appointments"."ends_at")
);
--> statement-breakpoint
CREATE TABLE "articles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"excerpt" text DEFAULT '' NOT NULL,
	"content_html" text NOT NULL,
	"cover_url" text,
	"tags" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	"status" "article_status" DEFAULT 'draft' NOT NULL,
	"author_id" uuid NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "articles_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"actor_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"ip" text,
	"meta" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "case_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"actor_id" uuid,
	"from_status" "case_status",
	"to_status" "case_status" NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"client_id" uuid NOT NULL,
	"status" "case_status" DEFAULT 'submitted' NOT NULL,
	"risk_level" "risk_level" DEFAULT 'none' NOT NULL,
	"answers" jsonb NOT NULL,
	"concerns" text DEFAULT '' NOT NULL,
	"preferred_mode" text,
	"assigned_expert_id" uuid,
	"rejection_reason" text,
	"admin_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"approved_at" timestamp with time zone,
	"assigned_at" timestamp with time zone,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "expert_availability" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"expert_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"start_minute" smallint NOT NULL,
	"end_minute" smallint NOT NULL,
	CONSTRAINT "availability_weekday_ck" CHECK ("expert_availability"."weekday" between 0 and 6),
	CONSTRAINT "availability_range_ck" CHECK ("expert_availability"."start_minute" >= 0 and "expert_availability"."end_minute" <= 1440 and "expert_availability"."start_minute" < "expert_availability"."end_minute")
);
--> statement-breakpoint
CREATE TABLE "expert_profiles" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"headline" text DEFAULT '' NOT NULL,
	"bio" text DEFAULT '' NOT NULL,
	"avatar_url" text,
	"credentials" text DEFAULT '' NOT NULL,
	"years_experience" integer DEFAULT 0 NOT NULL,
	"languages" text[] DEFAULT ARRAY['vi']::text[] NOT NULL,
	"modes" text[] DEFAULT ARRAY['online']::text[] NOT NULL,
	"fee_vnd" integer,
	"session_minutes" integer DEFAULT 50 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expert_specialties" (
	"expert_id" uuid NOT NULL,
	"specialty_id" integer NOT NULL,
	CONSTRAINT "expert_specialties_expert_id_specialty_id_pk" PRIMARY KEY("expert_id","specialty_id")
);
--> statement-breakpoint
CREATE TABLE "messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"case_id" uuid NOT NULL,
	"sender_id" uuid NOT NULL,
	"body" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"read_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "screening_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"position" integer NOT NULL,
	"prompt" text NOT NULL,
	"help_text" text,
	"type" "question_type" NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"required" boolean DEFAULT true NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ip" text,
	"user_agent" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "specialties" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "specialties_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'client' NOT NULL,
	"status" "user_status" DEFAULT 'active' NOT NULL,
	"full_name" text NOT NULL,
	"phone" text,
	"failed_logins" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_expert_id_users_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "appointments" ADD CONSTRAINT "appointments_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "articles" ADD CONSTRAINT "articles_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "case_events" ADD CONSTRAINT "case_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_client_id_users_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cases" ADD CONSTRAINT "cases_assigned_expert_id_users_id_fk" FOREIGN KEY ("assigned_expert_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_availability" ADD CONSTRAINT "expert_availability_expert_id_users_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_profiles" ADD CONSTRAINT "expert_profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_specialties" ADD CONSTRAINT "expert_specialties_expert_id_users_id_fk" FOREIGN KEY ("expert_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "expert_specialties" ADD CONSTRAINT "expert_specialties_specialty_id_specialties_id_fk" FOREIGN KEY ("specialty_id") REFERENCES "public"."specialties"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_case_id_cases_id_fk" FOREIGN KEY ("case_id") REFERENCES "public"."cases"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "messages" ADD CONSTRAINT "messages_sender_id_users_id_fk" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "appointments_expert_idx" ON "appointments" USING btree ("expert_id","starts_at");--> statement-breakpoint
CREATE INDEX "appointments_client_idx" ON "appointments" USING btree ("client_id","starts_at");--> statement-breakpoint
CREATE INDEX "articles_status_idx" ON "articles" USING btree ("status","published_at");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity","entity_id");--> statement-breakpoint
CREATE INDEX "audit_actor_idx" ON "audit_logs" USING btree ("actor_id");--> statement-breakpoint
CREATE INDEX "case_events_case_idx" ON "case_events" USING btree ("case_id");--> statement-breakpoint
CREATE INDEX "cases_client_idx" ON "cases" USING btree ("client_id");--> statement-breakpoint
CREATE INDEX "cases_expert_idx" ON "cases" USING btree ("assigned_expert_id");--> statement-breakpoint
CREATE INDEX "cases_status_idx" ON "cases" USING btree ("status");--> statement-breakpoint
CREATE INDEX "availability_expert_idx" ON "expert_availability" USING btree ("expert_id");--> statement-breakpoint
CREATE INDEX "messages_case_idx" ON "messages" USING btree ("case_id","created_at");--> statement-breakpoint
CREATE INDEX "sessions_user_idx" ON "sessions" USING btree ("user_id");
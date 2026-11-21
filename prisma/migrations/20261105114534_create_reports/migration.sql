-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "incworx";

-- CreateEnum
CREATE TYPE "incworx"."report_category" AS ENUM ('GLOBAL', 'DOMESTIC', 'SPECIAL');

-- CreateEnum
CREATE TYPE "incworx"."report_status" AS ENUM ('DRAFT', 'PUBLISHED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "incworx"."admin_users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "password_hash" VARCHAR(255) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incworx"."reports" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "title" VARCHAR(300) NOT NULL,
    "slug" VARCHAR(160) NOT NULL,
    "description" TEXT,
    "category" "incworx"."report_category" NOT NULL,
    "report_date" DATE NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "file_key" VARCHAR(512) NOT NULL,
    "file_size" INTEGER NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL DEFAULT 'application/pdf',
    "status" "incworx"."report_status" NOT NULL DEFAULT 'DRAFT',
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_users_email_key" ON "incworx"."admin_users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "reports_slug_key" ON "incworx"."reports"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "reports_file_key_key" ON "incworx"."reports"("file_key");

-- CreateIndex
CREATE INDEX "reports_status_report_date_idx" ON "incworx"."reports"("status", "report_date" DESC);

-- CreateIndex
CREATE INDEX "reports_status_category_report_date_idx" ON "incworx"."reports"("status", "category", "report_date" DESC);

-- CreateIndex
CREATE INDEX "reports_category_report_date_idx" ON "incworx"."reports"("category", "report_date" DESC);

-- CreateIndex
CREATE INDEX "reports_report_date_idx" ON "incworx"."reports"("report_date" DESC);

-- CreateIndex
CREATE INDEX "reports_created_by_id_idx" ON "incworx"."reports"("created_by_id");

-- AddForeignKey
ALTER TABLE "incworx"."reports" ADD CONSTRAINT "reports_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "incworx"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- HAND-WRITTEN — everything below this line.
--
-- Prisma's schema language cannot express CHECK constraints or privileges,
-- and Prisma Migrate does not diff either, so none of this causes drift.
-- Every statement is additive: nothing here drops, alters or reads existing data.
-- ============================================================================

-- Data integrity -------------------------------------------------------------

-- Admin e-mail is unique case-insensitively: the unique index above, plus the
-- rule that every stored address is already lower-case.
ALTER TABLE "incworx"."admin_users"
  ADD CONSTRAINT "admin_users_email_lowercase_chk"
  CHECK ("email" = lower("email"));

-- Slugs are URL-safe and lower-case, which also rules out two slugs that
-- differ only by letter case.
ALTER TABLE "incworx"."reports"
  ADD CONSTRAINT "reports_slug_format_chk"
  CHECK ("slug" ~ '^[a-z0-9]+(-[a-z0-9]+)*$');

-- A report's file key must sit in the final `reports/` namespace — so an
-- unverified `pending/` upload key can never be recorded as a report file —
-- and can never contain a path-traversal segment.
ALTER TABLE "incworx"."reports"
  ADD CONSTRAINT "reports_file_key_format_chk"
  CHECK ("file_key" ~ '^reports/[A-Za-z0-9][A-Za-z0-9._/-]*$'
         AND position('..' in "file_key") = 0);

ALTER TABLE "incworx"."reports"
  ADD CONSTRAINT "reports_file_size_positive_chk"
  CHECK ("file_size" > 0);

-- A published report always records when it was published.
ALTER TABLE "incworx"."reports"
  ADD CONSTRAINT "reports_published_at_chk"
  CHECK ("status" <> 'PUBLISHED' OR "published_at" IS NOT NULL);

-- Access hardening (Supabase) ------------------------------------------------
--
-- The `incworx` schema is not in Supabase's exposed-schemas list, so its
-- REST/GraphQL API cannot see these tables. The statements below keep that
-- true even if the schema were ever exposed by mistake:
--
--   * no USAGE on the schema for the API roles — the decisive guard: without
--     it, no table in the schema is reachable whatever its own grants say;
--   * row-level security on, with no policies, so API roles would be denied
--     every row. The table owner (the role Prisma connects as) bypasses RLS,
--     so the application itself is unaffected.
--
-- On plain PostgreSQL the API roles do not exist and that block is a no-op.

ALTER TABLE "incworx"."admin_users" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incworx"."reports"     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA "incworx" FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA "incworx" FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;

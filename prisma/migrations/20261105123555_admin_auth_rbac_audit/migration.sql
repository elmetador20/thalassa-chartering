-- CreateEnum
CREATE TYPE "incworx"."admin_role" AS ENUM ('SUPER_ADMIN', 'ADMIN');

-- CreateEnum
CREATE TYPE "incworx"."admin_approval_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "incworx"."audit_action" AS ENUM ('SUPER_ADMIN_SEEDED', 'ADMIN_CREATED', 'ADMIN_APPROVED', 'ADMIN_REJECTED', 'ADMIN_ACTIVATED', 'ADMIN_DEACTIVATED', 'LOGIN_SUCCEEDED', 'LOGIN_FAILED', 'LOGOUT', 'PASSWORD_CHANGED', 'REPORT_UPLOADED', 'REPORT_UPDATED', 'REPORT_FILE_REPLACED', 'REPORT_PUBLISHED', 'REPORT_ARCHIVED', 'REPORT_DELETED');

-- AlterTable
ALTER TABLE "incworx"."admin_users" ADD COLUMN     "approval_status" "incworx"."admin_approval_status" NOT NULL DEFAULT 'PENDING',
ADD COLUMN     "approved_at" TIMESTAMPTZ(3),
ADD COLUMN     "approved_by_id" UUID,
ADD COLUMN     "rejection_reason" VARCHAR(500),
ADD COLUMN     "role" "incworx"."admin_role" NOT NULL DEFAULT 'ADMIN',
ALTER COLUMN "is_active" SET DEFAULT false;

-- CreateTable
CREATE TABLE "incworx"."admin_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "token_hash" CHAR(64) NOT NULL,
    "admin_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_seen_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),

    CONSTRAINT "admin_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incworx"."auth_attempts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "key_hash" CHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incworx"."audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "action" "incworx"."audit_action" NOT NULL,
    "actor_id" UUID,
    "target_type" VARCHAR(40),
    "target_id" UUID,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "ip_address" VARCHAR(64),
    "user_agent" VARCHAR(512),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "admin_sessions_token_hash_key" ON "incworx"."admin_sessions"("token_hash");

-- CreateIndex
CREATE INDEX "admin_sessions_admin_user_id_idx" ON "incworx"."admin_sessions"("admin_user_id");

-- CreateIndex
CREATE INDEX "admin_sessions_expires_at_idx" ON "incworx"."admin_sessions"("expires_at");

-- CreateIndex
CREATE INDEX "auth_attempts_key_hash_created_at_idx" ON "incworx"."auth_attempts"("key_hash", "created_at");

-- CreateIndex
CREATE INDEX "auth_attempts_created_at_idx" ON "incworx"."auth_attempts"("created_at");

-- CreateIndex
CREATE INDEX "audit_logs_created_at_idx" ON "incworx"."audit_logs"("created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_actor_id_created_at_idx" ON "incworx"."audit_logs"("actor_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "audit_logs_target_type_target_id_created_at_idx" ON "incworx"."audit_logs"("target_type", "target_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_users_approval_status_created_at_idx" ON "incworx"."admin_users"("approval_status", "created_at" DESC);

-- AddForeignKey
ALTER TABLE "incworx"."admin_users" ADD CONSTRAINT "admin_users_approved_by_id_fkey" FOREIGN KEY ("approved_by_id") REFERENCES "incworx"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incworx"."admin_sessions" ADD CONSTRAINT "admin_sessions_admin_user_id_fkey" FOREIGN KEY ("admin_user_id") REFERENCES "incworx"."admin_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incworx"."audit_logs" ADD CONSTRAINT "audit_logs_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "incworx"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- HAND-WRITTEN — everything below this line.
--
-- Rules that must hold whatever writes to these tables (the app, Prisma
-- Studio, raw SQL). Prisma does not diff CHECKs, functions or triggers, so
-- none of this causes drift.
-- ============================================================================

-- Existing rows ---------------------------------------------------------------
-- Rows that predate this migration took the new defaults above: role ADMIN,
-- approval PENDING. A pending account must not be active, so align any such
-- row before the rule below is added. Nothing is deleted; such accounts simply
-- wait for Super Admin approval like any new one. (No rows exist unless an
-- account was inserted by hand — the app had no way to create one.)
UPDATE "incworx"."admin_users"
   SET "is_active" = false
 WHERE "approval_status" <> 'APPROVED' AND "is_active";

-- Account-state integrity ----------------------------------------------------

-- Only approved accounts can be active (pending / rejected never sign in).
ALTER TABLE "incworx"."admin_users"
  ADD CONSTRAINT "admin_users_active_requires_approval_chk"
  CHECK ("approval_status" = 'APPROVED' OR NOT "is_active");

-- An approval always records when it happened…
ALTER TABLE "incworx"."admin_users"
  ADD CONSTRAINT "admin_users_approval_timestamp_chk"
  CHECK ("approval_status" <> 'APPROVED' OR "approved_at" IS NOT NULL);

-- …and, for an ADMIN, who granted it. (The seeded Super Admin has no approver.)
ALTER TABLE "incworx"."admin_users"
  ADD CONSTRAINT "admin_users_admin_approval_has_approver_chk"
  CHECK ("role" = 'SUPER_ADMIN' OR "approval_status" <> 'APPROVED' OR "approved_by_id" IS NOT NULL);

-- Nobody approves themselves.
ALTER TABLE "incworx"."admin_users"
  ADD CONSTRAINT "admin_users_no_self_approval_chk"
  CHECK ("approved_by_id" IS NULL OR "approved_by_id" <> "id");

-- A Super Admin is always an approved account.
ALTER TABLE "incworx"."admin_users"
  ADD CONSTRAINT "admin_users_super_admin_approved_chk"
  CHECK ("role" <> 'SUPER_ADMIN' OR "approval_status" = 'APPROVED');

-- A rejection reason only exists on a rejected account.
ALTER TABLE "incworx"."admin_users"
  ADD CONSTRAINT "admin_users_rejection_reason_chk"
  CHECK ("rejection_reason" IS NULL OR "approval_status" = 'REJECTED');

ALTER TABLE "incworx"."admin_sessions"
  ADD CONSTRAINT "admin_sessions_expiry_after_creation_chk"
  CHECK ("expires_at" > "created_at");

-- Cross-row rules (need a trigger: a CHECK cannot look at other rows) ----------
--
--   1. The approver must be a SUPER_ADMIN.
--   2. The last active, approved SUPER_ADMIN can never be deactivated, demoted
--      or deleted. A transaction-scoped advisory lock serialises concurrent
--      attempts, so two simultaneous changes cannot each see "one other left".
CREATE FUNCTION "incworx"."admin_users_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  remaining integer;
BEGIN
  IF TG_OP IN ('INSERT', 'UPDATE')
     AND NEW.approved_by_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.approved_by_id IS DISTINCT FROM OLD.approved_by_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM "incworx"."admin_users"
       WHERE id = NEW.approved_by_id AND role = 'SUPER_ADMIN'
    ) THEN
      RAISE EXCEPTION 'admin_users_approver_is_super_admin: only a Super Admin can approve an administrator'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP IN ('UPDATE', 'DELETE')
     AND OLD.role = 'SUPER_ADMIN' AND OLD.is_active AND OLD.approval_status = 'APPROVED'
     AND (TG_OP = 'DELETE'
          OR NEW.role <> 'SUPER_ADMIN'
          OR NOT NEW.is_active
          OR NEW.approval_status <> 'APPROVED') THEN
    PERFORM pg_advisory_xact_lock(hashtext('incworx.admin_users.last_super_admin'));
    SELECT count(*) INTO remaining
      FROM "incworx"."admin_users"
     WHERE id <> OLD.id
       AND role = 'SUPER_ADMIN' AND is_active AND approval_status = 'APPROVED';
    IF remaining = 0 THEN
      RAISE EXCEPTION 'admin_users_last_super_admin: the last active Super Admin cannot be deactivated, demoted or deleted'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END
$$;

CREATE TRIGGER "admin_users_guard"
  BEFORE INSERT OR UPDATE OR DELETE ON "incworx"."admin_users"
  FOR EACH ROW EXECUTE FUNCTION "incworx"."admin_users_guard"();

-- Append-only audit trail ----------------------------------------------------
-- Rows can be added, never changed or removed — not even by the table owner
-- the app connects as. A retention job would have to disable this trigger
-- explicitly, which is itself a deliberate, visible act.
CREATE FUNCTION "incworx"."audit_logs_append_only"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs_append_only: audit records cannot be modified or deleted'
    USING ERRCODE = 'insufficient_privilege';
END
$$;

CREATE TRIGGER "audit_logs_no_update_delete"
  BEFORE UPDATE OR DELETE ON "incworx"."audit_logs"
  FOR EACH ROW EXECUTE FUNCTION "incworx"."audit_logs_append_only"();

CREATE TRIGGER "audit_logs_no_truncate"
  BEFORE TRUNCATE ON "incworx"."audit_logs"
  FOR EACH STATEMENT EXECUTE FUNCTION "incworx"."audit_logs_append_only"();

-- Access hardening (Supabase) — same treatment as the first migration --------
ALTER TABLE "incworx"."admin_sessions" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incworx"."auth_attempts"  ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incworx"."audit_logs"     ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON SCHEMA "incworx" FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL TABLES IN SCHEMA "incworx" FROM %I', api_role);
      EXECUTE format('REVOKE ALL ON ALL FUNCTIONS IN SCHEMA "incworx" FROM %I', api_role);
    END IF;
  END LOOP;
END
$$;

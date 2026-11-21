-- ============================================================================
-- Migration #4 — access requests and admin invitations.
--
-- Additive only: two new tables, one new enum, six new audit actions. No
-- existing table, column or row is changed. Statements are schema-qualified
-- (Prisma generated them unqualified, which would depend on search_path).
-- ============================================================================

-- CreateEnum
CREATE TYPE "incworx"."access_request_status" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- AlterEnum
-- Allowed in a transaction (PostgreSQL 12+): the new labels are not used
-- within this migration. Enum labels cannot be removed later; harmless if unused.
ALTER TYPE "incworx"."audit_action" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_SUBMITTED';
ALTER TYPE "incworx"."audit_action" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_APPROVED';
ALTER TYPE "incworx"."audit_action" ADD VALUE IF NOT EXISTS 'ACCESS_REQUEST_REJECTED';
ALTER TYPE "incworx"."audit_action" ADD VALUE IF NOT EXISTS 'INVITATION_CREATED';
ALTER TYPE "incworx"."audit_action" ADD VALUE IF NOT EXISTS 'INVITATION_ACCEPTED';
ALTER TYPE "incworx"."audit_action" ADD VALUE IF NOT EXISTS 'ROLE_ASSIGNED';

-- CreateTable
CREATE TABLE "incworx"."access_requests" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "full_name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "department" VARCHAR(160) NOT NULL,
    "designation" VARCHAR(120) NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "status" "incworx"."access_request_status" NOT NULL DEFAULT 'PENDING',
    "pending_email" VARCHAR(320),
    "assigned_role" "incworx"."admin_role",
    "reviewed_by_id" UUID,
    "reviewed_at" TIMESTAMPTZ(3),
    "rejection_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "access_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "incworx"."admin_invitations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "access_request_id" UUID NOT NULL,
    "email" VARCHAR(320) NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "role" "incworx"."admin_role" NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "revoked_at" TIMESTAMPTZ(3),
    "created_by_id" UUID NOT NULL,
    "accepted_by_id" UUID,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "admin_invitations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "access_requests_pending_email_key" ON "incworx"."access_requests"("pending_email");

-- CreateIndex
CREATE INDEX "access_requests_status_created_at_idx" ON "incworx"."access_requests"("status", "created_at" DESC);

-- CreateIndex
CREATE INDEX "access_requests_email_idx" ON "incworx"."access_requests"("email");

-- CreateIndex
CREATE UNIQUE INDEX "admin_invitations_token_hash_key" ON "incworx"."admin_invitations"("token_hash");

-- CreateIndex
CREATE UNIQUE INDEX "admin_invitations_accepted_by_id_key" ON "incworx"."admin_invitations"("accepted_by_id");

-- CreateIndex
CREATE INDEX "admin_invitations_access_request_id_created_at_idx" ON "incworx"."admin_invitations"("access_request_id", "created_at" DESC);

-- CreateIndex
CREATE INDEX "admin_invitations_created_by_id_idx" ON "incworx"."admin_invitations"("created_by_id");

-- AddForeignKey
ALTER TABLE "incworx"."access_requests" ADD CONSTRAINT "access_requests_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "incworx"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incworx"."admin_invitations" ADD CONSTRAINT "admin_invitations_access_request_id_fkey" FOREIGN KEY ("access_request_id") REFERENCES "incworx"."access_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incworx"."admin_invitations" ADD CONSTRAINT "admin_invitations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "incworx"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "incworx"."admin_invitations" ADD CONSTRAINT "admin_invitations_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "incworx"."admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ============================================================================
-- HAND-WRITTEN — rules that hold whatever writes to these tables (the app,
-- Prisma Studio, raw SQL). Prisma does not diff CHECKs, functions or
-- triggers, so none of this causes drift.
-- ============================================================================

-- access_requests --------------------------------------------------------------

ALTER TABLE "incworx"."access_requests"
  ADD CONSTRAINT "access_requests_email_lowercase_chk"
  CHECK ("email" = lower("email"));

-- One PENDING request per e-mail: pending_email mirrors email while pending
-- and is NULL otherwise; its unique index does the rest.
ALTER TABLE "incworx"."access_requests"
  ADD CONSTRAINT "access_requests_pending_email_chk"
  CHECK (("status" = 'PENDING') = ("pending_email" IS NOT NULL)
         AND ("pending_email" IS NULL OR "pending_email" = "email"));

-- Reviewed exactly when decided.
ALTER TABLE "incworx"."access_requests"
  ADD CONSTRAINT "access_requests_review_chk"
  CHECK (("status" = 'PENDING') = ("reviewed_at" IS NULL)
         AND ("status" = 'PENDING') = ("reviewed_by_id" IS NULL));

-- A role is recorded exactly when approved — and it is never Super Admin.
ALTER TABLE "incworx"."access_requests"
  ADD CONSTRAINT "access_requests_assigned_role_chk"
  CHECK (("status" = 'APPROVED') = ("assigned_role" IS NOT NULL)
         AND ("assigned_role" IS NULL OR "assigned_role" = 'ADMIN'));

ALTER TABLE "incworx"."access_requests"
  ADD CONSTRAINT "access_requests_rejection_reason_chk"
  CHECK ("rejection_reason" IS NULL OR "status" = 'REJECTED');

ALTER TABLE "incworx"."access_requests"
  ADD CONSTRAINT "access_requests_text_chk"
  CHECK (length(btrim("full_name")) > 0 AND length(btrim("department")) > 0
         AND length(btrim("designation")) > 0 AND length(btrim("reason")) > 0);

--   1. New requests always start PENDING (nobody can submit themselves approved).
--   2. Only an active SUPER_ADMIN can be recorded as the reviewer.
--   3. A decision is final: an approved or rejected request never changes status.
CREATE FUNCTION "incworx"."access_requests_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.status <> 'PENDING' THEN
    RAISE EXCEPTION 'access_requests_start_pending: a new access request must be pending'
      USING ERRCODE = 'check_violation';
  END IF;

  IF NEW.reviewed_by_id IS NOT NULL
     AND (TG_OP = 'INSERT' OR NEW.reviewed_by_id IS DISTINCT FROM OLD.reviewed_by_id) THEN
    IF NOT EXISTS (
      SELECT 1 FROM "incworx"."admin_users"
       WHERE id = NEW.reviewed_by_id AND role = 'SUPER_ADMIN' AND is_active
    ) THEN
      RAISE EXCEPTION 'access_requests_reviewer_is_super_admin: only an active Super Admin can review an access request'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.status <> 'PENDING' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'access_requests_decision_final: a reviewed access request cannot change status'
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "access_requests_guard"
  BEFORE INSERT OR UPDATE ON "incworx"."access_requests"
  FOR EACH ROW EXECUTE FUNCTION "incworx"."access_requests_guard"();

-- admin_invitations ------------------------------------------------------------

ALTER TABLE "incworx"."admin_invitations"
  ADD CONSTRAINT "admin_invitations_email_lowercase_chk"
  CHECK ("email" = lower("email"));

-- An invitation can never create a Super Admin.
ALTER TABLE "incworx"."admin_invitations"
  ADD CONSTRAINT "admin_invitations_role_chk"
  CHECK ("role" = 'ADMIN');

ALTER TABLE "incworx"."admin_invitations"
  ADD CONSTRAINT "admin_invitations_expiry_chk"
  CHECK ("expires_at" > "created_at");

ALTER TABLE "incworx"."admin_invitations"
  ADD CONSTRAINT "admin_invitations_outcome_chk"
  CHECK ("used_at" IS NULL OR "revoked_at" IS NULL);

-- Used exactly when an account was created from it.
ALTER TABLE "incworx"."admin_invitations"
  ADD CONSTRAINT "admin_invitations_accepted_chk"
  CHECK (("used_at" IS NOT NULL) = ("accepted_by_id" IS NOT NULL));

--   1. Created only by an active SUPER_ADMIN, for an APPROVED request with the
--      same e-mail.
--   2. What an invitation grants (token, e-mail, name, role, request, creator,
--      expiry) can never be changed afterwards.
--   3. Single use: once used or revoked, that outcome is permanent.
CREATE FUNCTION "incworx"."admin_invitations_guard"() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "incworx"."admin_users"
       WHERE id = NEW.created_by_id AND role = 'SUPER_ADMIN' AND is_active
    ) THEN
      RAISE EXCEPTION 'admin_invitations_creator_is_super_admin: only an active Super Admin can create an invitation'
        USING ERRCODE = 'check_violation';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM "incworx"."access_requests"
       WHERE id = NEW.access_request_id AND status = 'APPROVED' AND email = NEW.email
    ) THEN
      RAISE EXCEPTION 'admin_invitations_request_approved: an invitation needs an approved request for the same e-mail'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    IF (NEW.token_hash, NEW.email, NEW.name, NEW.role, NEW.access_request_id, NEW.created_by_id, NEW.expires_at, NEW.created_at)
       IS DISTINCT FROM
       (OLD.token_hash, OLD.email, OLD.name, OLD.role, OLD.access_request_id, OLD.created_by_id, OLD.expires_at, OLD.created_at) THEN
      RAISE EXCEPTION 'admin_invitations_immutable: an invitation cannot be altered'
        USING ERRCODE = 'check_violation';
    END IF;
    IF (OLD.used_at IS NOT NULL OR OLD.revoked_at IS NOT NULL)
       AND (NEW.used_at, NEW.revoked_at, NEW.accepted_by_id) IS DISTINCT FROM (OLD.used_at, OLD.revoked_at, OLD.accepted_by_id) THEN
      RAISE EXCEPTION 'admin_invitations_single_use: a used or revoked invitation is final'
        USING ERRCODE = 'check_violation';
    END IF;
  END IF;

  RETURN NEW;
END
$$;

CREATE TRIGGER "admin_invitations_guard"
  BEFORE INSERT OR UPDATE ON "incworx"."admin_invitations"
  FOR EACH ROW EXECUTE FUNCTION "incworx"."admin_invitations_guard"();

-- Access hardening (Supabase) — same treatment as the earlier migrations ------

ALTER TABLE "incworx"."access_requests"   ENABLE ROW LEVEL SECURITY;
ALTER TABLE "incworx"."admin_invitations" ENABLE ROW LEVEL SECURITY;

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

-- ----------------------------------------------------------------------------
-- Manual rollback (NOT run by Prisma). Only for an emergency, after review;
-- dropping the tables discards every access request and invitation:
--
--   DROP TABLE "incworx"."admin_invitations";
--   DROP TABLE "incworx"."access_requests";
--   DROP FUNCTION "incworx"."admin_invitations_guard"();
--   DROP FUNCTION "incworx"."access_requests_guard"();
--   DROP TYPE "incworx"."access_request_status";
--   DELETE FROM "incworx"."_prisma_migrations"
--    WHERE "migration_name" = '20261106120000_access_requests_invitations';
--   -- The new audit_action labels cannot be removed; leave them.
-- ----------------------------------------------------------------------------

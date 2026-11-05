-- ============================================================================
-- Migration #3 — report archive / restore.
--
-- Additive only. Nothing is dropped. The single UPDATE below fills a NULL in
-- rows that would otherwise violate the new rule; it matches 0 rows on a
-- database that has never had an archived report.
--
-- Statements are schema-qualified on purpose: Prisma generated them
-- unqualified, which would only work while the connection's search_path
-- happens to be `incworx`.
-- ============================================================================

-- AlterEnum
-- PostgreSQL cannot drop an enum label, so this is permanent — and harmless if
-- ever unused. Allowed inside a transaction (PostgreSQL 12+) as long as the new
-- label is not used in that same transaction, which it is not.
ALTER TYPE "incworx"."audit_action" ADD VALUE IF NOT EXISTS 'REPORT_RESTORED';

-- AlterTable
ALTER TABLE "incworx"."reports" ADD COLUMN "archived_at" TIMESTAMPTZ(3);

-- ============================================================================
-- HAND-WRITTEN
-- ============================================================================

-- Backfill: a report already ARCHIVED before this migration gets a timestamp
-- (its last update — the best available approximation), so the rule below can
-- be added without rejecting existing data.
UPDATE "incworx"."reports"
   SET "archived_at" = "updated_at"
 WHERE "status" = 'ARCHIVED' AND "archived_at" IS NULL;

-- archived_at is set exactly while a report is archived: archiving sets it,
-- restoring (back to DRAFT) clears it.
ALTER TABLE "incworx"."reports"
  ADD CONSTRAINT "reports_archived_at_chk"
  CHECK (("status" = 'ARCHIVED') = ("archived_at" IS NOT NULL));

-- ----------------------------------------------------------------------------
-- Manual rollback (NOT run by Prisma — there are no down-migrations). Only for
-- an emergency, after reviewing; dropping the column discards archive dates:
--
--   ALTER TABLE "incworx"."reports" DROP CONSTRAINT "reports_archived_at_chk";
--   ALTER TABLE "incworx"."reports" DROP COLUMN "archived_at";
--   DELETE FROM "incworx"."_prisma_migrations"
--    WHERE "migration_name" = '<this migration folder name>';
--   -- The REPORT_RESTORED enum label cannot be removed; leave it.
-- ----------------------------------------------------------------------------

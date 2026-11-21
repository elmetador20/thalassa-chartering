import 'server-only';
import { toFieldErrors, type FieldErrors } from '@/lib/validation/auth';
import { hashPassword } from './password';
import { createAdminServerSchema } from './password-strength';
import { recordAudit } from '../audit';
import { getDb } from '../db';

// ============================================================================
// The one way a SUPER_ADMIN comes into existence.
//
// Idempotent and deliberately unhelpful beyond its single job:
//   - if any Super Admin already exists, it does nothing at all — it never
//     creates a second one and never resets an existing one's password;
//   - it refuses an e-mail already used by an ordinary admin rather than
//     promoting that account;
//   - a transaction-scoped advisory lock means two seeds started at once
//     cannot both create one.
// The password goes through the same strong-password schema as every admin.
// ============================================================================

export type SeedResult =
  | { status: 'created'; adminId: string }
  | { status: 'exists' }
  | { status: 'email_taken' }
  | { status: 'invalid'; fieldErrors: FieldErrors };

export async function seedSuperAdmin(raw: { name: unknown; email: unknown; password: unknown }): Promise<SeedResult> {
  const parsed = await createAdminServerSchema.safeParseAsync({ ...raw, confirmPassword: raw.password });
  if (!parsed.success) return { status: 'invalid', fieldErrors: toFieldErrors(parsed.error) };
  const { name, email, password } = parsed.data;

  const db = getDb();
  // Cheap early exit before paying for a hash.
  if (await db.adminUser.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } })) {
    return { status: 'exists' };
  }
  const passwordHash = await hashPassword(password);

  return db.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(hashtext('incworx.seed_super_admin'))`);
    if (await tx.adminUser.findFirst({ where: { role: 'SUPER_ADMIN' }, select: { id: true } })) {
      return { status: 'exists' as const };
    }
    if (await tx.adminUser.findUnique({ where: { email }, select: { id: true } })) {
      return { status: 'email_taken' as const };
    }
    const admin = await tx.adminUser.create({
      data: {
        name,
        email,
        passwordHash,
        role: 'SUPER_ADMIN',
        approvalStatus: 'APPROVED',
        isActive: true,
        approvedAt: new Date(),
      },
      select: { id: true },
    });
    await recordAudit(tx, {
      action: 'SUPER_ADMIN_SEEDED',
      actorId: null,
      targetType: 'admin_user',
      targetId: admin.id,
      metadata: { via: 'seed-script' },
    });
    return { status: 'created' as const, adminId: admin.id };
  });
}

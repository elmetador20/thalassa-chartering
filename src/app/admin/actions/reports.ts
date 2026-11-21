'use server';

import { revalidatePath } from 'next/cache';
import type { CreatedReportData, ReportActionResult } from '@/lib/reports/action-types';
import { ForbiddenError } from '@/lib/server/auth/errors';
import { getRequestMeta, requireActionSession } from '@/lib/server/auth/guards';
import { ReportError } from '@/lib/server/reports/errors';
import {
  archiveReport,
  createReport,
  deleteReport,
  publishReport,
  replaceReportFile,
  restoreReport,
  updateReport,
} from '@/lib/server/reports/service';
import { describeErrorSafely } from '@/lib/server/safe-error';

// Report actions. Each re-validates the session against the database; the
// service checks the permission and validates every argument (typed `unknown`
// on purpose — anything can arrive over the wire). Server actions also carry
// Next.js's built-in Origin check, and the session cookie is SameSite=Strict.

function refresh(id?: string, slug?: string): void {
  revalidatePath('/admin');
  revalidatePath('/admin/reports');
  if (id) revalidatePath(`/admin/reports/${id}/edit`);
  revalidatePath('/reports');
  if (slug) revalidatePath(`/reports/${slug}`);
  revalidatePath('/sitemap.xml');
}

async function attempt<T>(
  label: string,
  run: () => Promise<{ data: T; message: string; warnings?: string[]; id?: string; slug?: string }>,
): Promise<ReportActionResult<T>> {
  try {
    const out = await run();
    refresh(out.id, out.slug);
    return { ok: true, message: out.message, data: out.data, warnings: out.warnings ?? [] };
  } catch (error) {
    if (error instanceof ForbiddenError) return { ok: false, code: 'forbidden', message: error.message };
    if (error instanceof ReportError) return { ok: false, code: error.code, message: error.message, fieldErrors: error.fieldErrors };
    console.error(`[reports] ${label} failed: ${describeErrorSafely(error)}`);
    return { ok: false, code: 'unexpected', message: 'Something went wrong and nothing was changed. Please try again.' };
  }
}

const statusMessage = (status: string, duplicate: boolean) =>
  duplicate ? 'This report was already saved.' : status === 'PUBLISHED' ? 'Report published.' : 'Report saved as a draft.';

export async function createReportAction(input: unknown): Promise<ReportActionResult<CreatedReportData>> {
  const ctx = await requireActionSession();
  return attempt('create', async () => {
    const r = await createReport(ctx, input, { request: getRequestMeta() });
    return {
      data: { id: r.id, slug: r.slug, status: r.status, duplicate: r.duplicate },
      message: statusMessage(r.status, r.duplicate),
      warnings: r.warnings,
      id: r.id,
      slug: r.slug,
    };
  });
}

export async function updateReportAction(id: unknown, input: unknown): Promise<ReportActionResult<{ changed: string[] }>> {
  const ctx = await requireActionSession();
  return attempt('update', async () => {
    const r = await updateReport(ctx, id, input, { request: getRequestMeta() });
    return {
      data: { changed: r.changed },
      message: r.changed.length ? 'Changes saved.' : 'Nothing to save — no details changed.',
      id: String(id),
      slug: r.slug,
    };
  });
}

export async function replaceReportFileAction(id: unknown, input: unknown): Promise<ReportActionResult<null>> {
  const ctx = await requireActionSession();
  return attempt('replace file', async () => {
    const r = await replaceReportFile(ctx, id, input, { request: getRequestMeta() });
    return { data: null, message: r.duplicate ? 'This PDF is already in place.' : 'PDF replaced.', warnings: r.warnings, id: String(id) };
  });
}

export async function publishReportAction(id: unknown): Promise<ReportActionResult<null>> {
  const ctx = await requireActionSession();
  return attempt('publish', async () => {
    const r = await publishReport(ctx, id, { request: getRequestMeta() });
    return { data: null, message: 'Report published.', id: String(id), slug: r.slug };
  });
}

export async function archiveReportAction(id: unknown): Promise<ReportActionResult<null>> {
  const ctx = await requireActionSession();
  return attempt('archive', async () => {
    const r = await archiveReport(ctx, id, { request: getRequestMeta() });
    return { data: null, message: 'Report archived. It is no longer visible on the website.', id: String(id), slug: r.slug };
  });
}

export async function restoreReportAction(id: unknown): Promise<ReportActionResult<null>> {
  const ctx = await requireActionSession();
  return attempt('restore', async () => {
    const r = await restoreReport(ctx, id, { request: getRequestMeta() });
    return { data: null, message: 'Report restored as a draft. Publish it when ready.', id: String(id), slug: r.slug };
  });
}

export async function deleteReportAction(id: unknown, confirmation: unknown): Promise<ReportActionResult<null>> {
  const ctx = await requireActionSession();
  return attempt('delete', async () => {
    const r = await deleteReport(ctx, id, confirmation, { request: getRequestMeta() });
    return { data: null, message: 'Report permanently deleted.', warnings: r.warnings, slug: r.slug };
  });
}

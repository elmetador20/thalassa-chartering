// Browser side of a bulk import: talks to /api/admin/report-imports/*, PUTs
// each PDF straight to storage, and runs rows through a small worker pool so
// a large collection never floods the server or the network.

import type { FieldErrors } from '@/lib/validation/auth';
import type { ExistingReportRef, ImportCheckResult, ImportRow } from './bulk-import';
import { PDF_MIME_TYPE } from './constants';
import { putFile, UploadFailure, type IssuedUpload } from './upload-client';

/** An API refusal. `fatal` ones stop the whole import (no point continuing). */
export class ImportApiError extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = 'ImportApiError';
  }
  get fatal(): boolean {
    return ['storage_unavailable', 'unauthenticated', 'rate_limited', 'forbidden', 'forbidden_origin'].includes(this.code);
  }
}

async function postJson<T>(url: string, body: unknown, signal?: AbortSignal): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify(body),
      signal,
    });
  } catch {
    if (signal?.aborted) throw new ImportApiError('aborted', 'Stopped.');
    throw new ImportApiError('network', 'Could not reach the server. Check your connection.');
  }
  const json = (await response.json().catch(() => null)) as (T & { error?: { code: string; message: string; fieldErrors?: FieldErrors } }) | null;
  if (!response.ok || !json) {
    if (response.status === 401) throw new ImportApiError('unauthenticated', 'Your session has ended. Sign in again, then retry the failed rows.');
    throw new ImportApiError(json?.error?.code ?? 'unexpected', json?.error?.message ?? 'The server could not process this row.', json?.error?.fieldErrors);
  }
  return json;
}

export type RowWithSize = ImportRow & { fileSize?: number };

export function checkImportRows(rows: RowWithSize[]) {
  return postJson<{ results: ImportCheckResult[]; storageConfigured: boolean }>('/api/admin/report-imports/check', { rows });
}

export type RowOutcome = { state: 'imported'; report: { id: string; slug: string } } | { state: 'already'; report: { id: string; slug: string } };

/** One row: upload URL → PUT (with progress) → verify + create. */
export async function importOneRow(
  row: ImportRow,
  file: File,
  hooks: { onUploadProgress: (fraction: number) => void; onSaving: () => void; signal?: AbortSignal },
): Promise<RowOutcome> {
  const payload = { ...row, fileSize: file.size };
  const issued = await postJson<{ alreadyImported: ExistingReportRef | null; upload: IssuedUpload | null }>(
    '/api/admin/report-imports/upload',
    payload,
    hooks.signal,
  );
  if (issued.alreadyImported) return { state: 'already', report: issued.alreadyImported };
  if (!issued.upload) throw new ImportApiError('unexpected', 'The server did not return an upload link.');

  try {
    await putFile({ ...issued.upload, headers: { 'Content-Type': PDF_MIME_TYPE, ...issued.upload.headers } }, file, hooks.onUploadProgress, hooks.signal);
  } catch (error) {
    if (error instanceof UploadFailure) throw new ImportApiError(error.code === 'aborted' ? 'aborted' : 'upload_failed', error.message);
    throw error;
  }

  hooks.onSaving();
  const created = await postJson<{ id: string; slug: string; duplicate: boolean }>(
    '/api/admin/report-imports/commit',
    { ...payload, uploadKey: issued.upload.uploadKey },
    hooks.signal,
  );
  return { state: created.duplicate ? 'already' : 'imported', report: { id: created.id, slug: created.slug } };
}

/**
 * Runs `worker` over `items`, at most `concurrency` at a time. `shouldStop`
 * is checked before each new item starts; running items always finish.
 */
export async function runPool<T>(items: T[], concurrency: number, worker: (item: T) => Promise<void>, shouldStop: () => boolean): Promise<void> {
  let next = 0;
  const lanes = Array.from({ length: Math.max(1, Math.min(concurrency, items.length)) }, async () => {
    while (next < items.length && !shouldStop()) {
      const item = items[next++];
      await worker(item);
    }
  });
  await Promise.all(lanes);
}

export function downloadTextFile(name: string, content: string, type = 'text/csv;charset=utf-8'): void {
  // The BOM makes Excel read the file as UTF-8 (titles may contain ₹, é, —).
  const blob = new Blob(['﻿', content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// Browser side of a PDF upload:
//   1. ask our API for a short-lived signed URL (POST /api/admin/report-uploads)
//   2. PUT the file straight to storage with progress (XHR — fetch has no
//      upload progress)
// The server then verifies what arrived when the report is saved.

import type { FieldErrors } from '@/lib/validation/auth';
import { checkPdfFile } from '@/lib/validation/reports';
import { PDF_MAGIC_BYTES, PDF_MIME_TYPE } from './constants';

export class UploadFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly fieldErrors?: FieldErrors,
  ) {
    super(message);
    this.name = 'UploadFailure';
  }
}

export interface UploadedPdf {
  uploadKey: string;
  fileName: string;
  size: number;
}

/** Quick checks before anything is sent: extension, type, size, signature. */
export async function precheckPdf(file: File): Promise<string | null> {
  const problem = checkPdfFile(file);
  if (problem) return problem;
  try {
    const head = new Uint8Array(await file.slice(0, PDF_MAGIC_BYTES.length).arrayBuffer());
    if (new TextDecoder().decode(head) !== PDF_MAGIC_BYTES) return 'This file is not a valid PDF.';
  } catch {
    return 'The file could not be read. Choose it again.';
  }
  return null;
}

interface IssuedUpload {
  uploadKey: string;
  url: string;
  method: 'PUT';
  headers: Record<string, string>;
  expiresAt: string;
}

async function requestUploadUrl(file: File, signal?: AbortSignal): Promise<IssuedUpload> {
  let response: Response;
  try {
    response = await fetch('/api/admin/report-uploads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      cache: 'no-store',
      body: JSON.stringify({ fileName: file.name, contentType: PDF_MIME_TYPE, size: file.size }),
      signal,
    });
  } catch {
    if (signal?.aborted) throw new UploadFailure('aborted', 'Upload cancelled.');
    throw new UploadFailure('network', 'Could not reach the server. Check your connection and try again.');
  }
  const body = (await response.json().catch(() => null)) as (IssuedUpload & { error?: { code: string; message: string; fieldErrors?: FieldErrors } }) | null;
  if (!response.ok || !body?.url) {
    if (response.status === 401) throw new UploadFailure('unauthenticated', 'Your session has ended. Sign in again, then retry.');
    throw new UploadFailure(body?.error?.code ?? 'unexpected', body?.error?.message ?? 'The upload could not be started.', body?.error?.fieldErrors);
  }
  return body;
}

function putFile(issued: IssuedUpload, file: File, onProgress: (fraction: number) => void, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(issued.method, issued.url);
    for (const [name, value] of Object.entries(issued.headers)) xhr.setRequestHeader(name, value);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded / event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        onProgress(1);
        resolve();
      } else if (xhr.status === 403) {
        reject(new UploadFailure('expired', 'The upload link expired or was refused. Try again.'));
      } else {
        reject(new UploadFailure('storage', 'The file storage refused the upload. Try again in a moment.'));
      }
    };
    xhr.onerror = () => reject(new UploadFailure('network', 'The upload was interrupted. Check your connection and try again.'));
    xhr.onabort = () => reject(new UploadFailure('aborted', 'Upload cancelled.'));
    signal?.addEventListener('abort', () => xhr.abort(), { once: true });
    xhr.send(file);
  });
}

/** Steps 1–2. Returns the key to submit with the report details. */
export async function uploadPdf(file: File, options: { onProgress: (fraction: number) => void; signal?: AbortSignal }): Promise<UploadedPdf> {
  const issued = await requestUploadUrl(file, options.signal);
  options.onProgress(0);
  await putFile(issued, file, options.onProgress, options.signal);
  return { uploadKey: issued.uploadKey, fileName: file.name, size: file.size };
}

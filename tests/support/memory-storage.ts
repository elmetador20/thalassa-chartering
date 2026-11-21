import { randomUUID } from 'node:crypto';
import type { PresignedDownload, PresignedUpload, ReportStorage, StoredObjectInfo } from '@/lib/server/storage';
import { StorageError } from '@/lib/server/storage';

// ============================================================================
// In-memory stand-in for R2 — AUTOMATED TESTS ONLY. It lives under tests/ so
// production code cannot import it (a unit test enforces that).
//
// Models the R2 behaviour the app depends on:
//   - presigned uploads expire, and the signed size and type must match;
//   - copy needs the source to exist; delete is idempotent;
// and lets a test make any operation fail on demand.
// ============================================================================

export type StorageOperation = 'createUploadUrl' | 'createDownloadUrl' | 'head' | 'readStart' | 'copy' | 'delete' | 'list';

interface UploadIntent {
  key: string;
  contentType: string;
  contentLength: number;
  expiresAt: number;
}

export class MemoryStorage implements ReportStorage {
  readonly kind = 'memory' as const;
  readonly objects = new Map<string, { bytes: Uint8Array; contentType: string; lastModified: Date }>();
  readonly calls: { op: StorageOperation; key?: string }[] = [];
  private readonly uploads = new Map<string, UploadIntent>();
  private readonly failures = new Map<StorageOperation, { error: Error; times: number; keyPrefix?: string }>();
  now: () => number = () => Date.now();

  /** Make the next `times` calls of `op` (optionally only for keys under a prefix) fail. */
  failOn(op: StorageOperation, options: { times?: number; keyPrefix?: string } = {}): void {
    this.failures.set(op, { error: new StorageError(op, `simulated ${op} failure`, 503), times: options.times ?? 1, keyPrefix: options.keyPrefix });
  }

  private record(op: StorageOperation, key?: string): void {
    this.calls.push({ op, key });
    const failure = this.failures.get(op);
    if (failure && failure.times > 0 && (!failure.keyPrefix || (key ?? '').startsWith(failure.keyPrefix))) {
      failure.times -= 1;
      throw failure.error;
    }
  }

  async createUploadUrl(input: { key: string; contentType: string; contentLength: number; expiresInSeconds: number }): Promise<PresignedUpload> {
    this.record('createUploadUrl', input.key);
    const token = randomUUID();
    const expiresAt = this.now() + input.expiresInSeconds * 1000;
    this.uploads.set(token, { key: input.key, contentType: input.contentType, contentLength: input.contentLength, expiresAt });
    return { url: `memory://upload/${token}`, method: 'PUT', headers: { 'Content-Type': input.contentType }, expiresAt: new Date(expiresAt) };
  }

  /** What a browser + R2 do with a presigned PUT URL. Throws as R2 would (403). */
  async simulateBrowserUpload(url: string, bytes: Uint8Array, contentType = 'application/pdf'): Promise<void> {
    const intent = this.uploads.get(url.replace('memory://upload/', ''));
    if (!intent) throw new Error('403: unknown or tampered upload URL');
    if (this.now() > intent.expiresAt) throw new Error('403: upload URL expired');
    if (bytes.length !== intent.contentLength) throw new Error('403: content-length does not match the signed length');
    if (contentType !== intent.contentType) throw new Error('403: content-type does not match the signed type');
    this.objects.set(intent.key, { bytes, contentType, lastModified: new Date(this.now()) });
  }

  /** Seed an object directly (bypassing the upload flow). */
  put(key: string, bytes: Uint8Array, contentType = 'application/pdf'): void {
    this.objects.set(key, { bytes, contentType, lastModified: new Date(this.now()) });
  }

  async createDownloadUrl(input: { key: string; fileName: string; disposition: 'inline' | 'attachment'; expiresInSeconds: number }): Promise<PresignedDownload> {
    this.record('createDownloadUrl', input.key);
    const expiresAt = new Date(this.now() + input.expiresInSeconds * 1000);
    const query = new URLSearchParams({ disposition: input.disposition, name: input.fileName, exp: String(expiresAt.getTime()) });
    return { url: `memory://download/${input.key}?${query}`, expiresAt };
  }

  async head(key: string): Promise<StoredObjectInfo | null> {
    this.record('head', key);
    const o = this.objects.get(key);
    return o ? { size: o.bytes.length, contentType: o.contentType } : null;
  }

  async readStart(key: string, bytes: number): Promise<Uint8Array> {
    this.record('readStart', key);
    const o = this.objects.get(key);
    if (!o) throw new StorageError('read', 'NoSuchKey', 404);
    return o.bytes.slice(0, bytes);
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    this.record('copy', destinationKey);
    const o = this.objects.get(sourceKey);
    if (!o) throw new StorageError('copy', 'NoSuchKey', 404);
    this.objects.set(destinationKey, { ...o, lastModified: new Date(this.now()) });
  }

  async delete(key: string): Promise<void> {
    this.record('delete', key);
    this.objects.delete(key);
  }

  async list(prefix: string): Promise<{ key: string; lastModified: Date | null; size: number }[]> {
    this.record('list', prefix);
    return [...this.objects.entries()].filter(([k]) => k.startsWith(prefix)).map(([key, o]) => ({ key, lastModified: o.lastModified, size: o.bytes.length }));
  }

  keys(prefix = ''): string[] {
    return [...this.objects.keys()].filter((k) => k.startsWith(prefix)).sort();
  }
}

/** A tiny but genuine PDF header + body. */
export function fakePdf(sizeBytes = 2048): Uint8Array {
  const header = new TextEncoder().encode('%PDF-1.7\n%\xE2\xE3\xCF\xD3\n');
  const out = new Uint8Array(Math.max(sizeBytes, header.length));
  out.set(header);
  out.fill(0x20, header.length);
  return out;
}

/** Bytes that are not a PDF, e.g. an HTML page or a ZIP renamed to .pdf. */
export function notAPdf(kind: 'html' | 'zip' = 'html', sizeBytes = 2048): Uint8Array {
  const header = new TextEncoder().encode(kind === 'html' ? '<html><script>alert(1)</script>' : 'PK\u0003\u0004');
  const out = new Uint8Array(Math.max(sizeBytes, header.length));
  out.set(header);
  return out;
}

import 'server-only';

// ============================================================================
// Storage for report PDFs.
//
// Everything that touches PDF bytes goes through this interface, so the rest
// of the app does not know or care which backend is behind it:
//
//   R2Storage           production — Cloudflare R2 (S3 API), private bucket
//   UnconfiguredStorage production while R2 credentials are absent: every
//                       call fails with StorageNotConfiguredError
//   MemoryStorage       automated tests only — lives in tests/, never in src/
//
// There is deliberately no local-filesystem implementation and no fallback:
// if R2 is not configured, file operations fail clearly.
// PDF bytes never touch PostgreSQL — the database stores only the object key.
// ============================================================================

export interface StoredObjectInfo {
  size: number;
  contentType: string | null;
}

export interface PresignedUpload {
  url: string;
  method: 'PUT';
  /** Headers the browser must send (they are part of the signature). */
  headers: Record<string, string>;
  expiresAt: Date;
}

export interface PresignedDownload {
  url: string;
  expiresAt: Date;
}

export interface ReportStorage {
  readonly kind: 'r2' | 'unconfigured' | 'memory';

  /** A short-lived URL the browser can PUT exactly this object to — the
   *  content type and byte length are signed, so a different file is refused. */
  createUploadUrl(input: { key: string; contentType: string; contentLength: number; expiresInSeconds: number }): Promise<PresignedUpload>;

  /** A short-lived URL to read the object, with the given download name. */
  createDownloadUrl(input: { key: string; fileName: string; disposition: 'inline' | 'attachment'; expiresInSeconds: number }): Promise<PresignedDownload>;

  /** Size and type, or null if the object does not exist. */
  head(key: string): Promise<StoredObjectInfo | null>;

  /** The first `bytes` bytes (fewer if the object is shorter). */
  readStart(key: string, bytes: number): Promise<Uint8Array>;

  /** Server-side copy within the bucket — no bytes pass through this server. */
  copy(sourceKey: string, destinationKey: string): Promise<void>;

  /** Idempotent: deleting a missing object succeeds. */
  delete(key: string): Promise<void>;

  /** Keys under a prefix (for reconciliation). */
  list(prefix: string): Promise<{ key: string; lastModified: Date | null; size: number }[]>;
}

/** R2 credentials are missing or still template values. Safe to show: it
 *  names variables, never their values. */
export class StorageNotConfiguredError extends Error {
  constructor(readonly reason: string) {
    super(`PDF storage is not configured: ${reason}`);
    this.name = 'StorageNotConfiguredError';
  }
}

/** A storage operation failed (network, permissions, missing object…). */
export class StorageError extends Error {
  constructor(
    readonly operation: string,
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = 'StorageError';
  }
}

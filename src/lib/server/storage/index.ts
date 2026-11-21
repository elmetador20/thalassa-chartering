import 'server-only';
import { readR2Config } from './config';
import { R2Storage } from './r2';
import { StorageNotConfiguredError, type ReportStorage } from './types';

export { StorageError, StorageNotConfiguredError } from './types';
export type { ReportStorage, PresignedUpload, PresignedDownload, StoredObjectInfo } from './types';

/** Production while R2 is not configured: every operation fails clearly.
 *  Never a fake, never the local disk. */
class UnconfiguredStorage implements ReportStorage {
  readonly kind = 'unconfigured' as const;
  constructor(private readonly reason: string) {}
  private fail(): never {
    throw new StorageNotConfiguredError(this.reason);
  }
  createUploadUrl = async () => this.fail();
  createDownloadUrl = async () => this.fail();
  head = async () => this.fail();
  readStart = async () => this.fail();
  copy = async () => this.fail();
  delete = async () => this.fail();
  list = async () => this.fail();
}

let cached: { signature: string; storage: ReportStorage } | null = null;

/** The storage backend for this process, chosen from the environment. */
export function getStorage(): ReportStorage {
  const result = readR2Config();
  const signature = result.ok ? `${result.config.accountId}:${result.config.bucket}:${result.config.accessKeyId}` : `none:${result.reason}`;
  if (cached?.signature !== signature) {
    cached = { signature, storage: result.ok ? new R2Storage(result.config) : new UnconfiguredStorage(result.reason) };
  }
  return cached.storage;
}

/** Whether storage is usable — for UI banners. Names variables, never values. */
export function getStorageStatus(): { configured: true } | { configured: false; reason: string } {
  const result = readR2Config();
  return result.ok ? { configured: true } : { configured: false, reason: result.reason };
}

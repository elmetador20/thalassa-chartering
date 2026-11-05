import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readR2Config } from '@/lib/server/storage/config';
import { R2Storage } from '@/lib/server/storage/r2';
import { getStorage, getStorageStatus, StorageNotConfiguredError } from '@/lib/server/storage';
import { fakePdf, MemoryStorage } from '../support/memory-storage';

// Fake, correctly shaped credentials — offline signing only, never sent anywhere.
const FAKE = {
  R2_ACCOUNT_ID: '0123456789abcdef0123456789abcdef',
  R2_ACCESS_KEY_ID: 'fedcba9876543210fedcba9876543210',
  R2_SECRET_ACCESS_KEY: 'a'.repeat(64),
  R2_BUCKET_NAME: 'test-pdf-bucket',
};

describe('R2 configuration', () => {
  it('treats the template values in .env as not configured', () => {
    const r = readR2Config({ R2_ACCOUNT_ID: 'your_account_id', R2_ACCESS_KEY_ID: 'your_access_key', R2_SECRET_ACCESS_KEY: 'your_secret', R2_BUCKET_NAME: 'test-pdf-bucket' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.reason).toMatch(/R2_ACCOUNT_ID is not 32 hex characters/);
  });

  it('reports missing variables by name, never by value', () => {
    const r = readR2Config({ R2_SECRET_ACCESS_KEY: 'b'.repeat(64) });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.reason).toContain('R2_ACCOUNT_ID is not set');
      expect(r.reason).not.toContain('b'.repeat(64));
    }
  });

  it('derives the endpoint, and ignores a stale or foreign R2_ENDPOINT', () => {
    const r = readR2Config({ ...FAKE, R2_ENDPOINT: 'https://your_account_id.r2.cloudflarestorage.com' });
    expect(r.ok && r.config.endpoint).toBe(`https://${FAKE.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    const evil = readR2Config({ ...FAKE, R2_ENDPOINT: 'https://attacker.example' });
    expect(evil.ok && evil.config.endpoint).toBe(`https://${FAKE.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    const eu = readR2Config({ ...FAKE, R2_ENDPOINT: `https://${FAKE.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com` });
    expect(eu.ok && eu.config.endpoint).toBe(`https://${FAKE.R2_ACCOUNT_ID}.eu.r2.cloudflarestorage.com`);
  });
});

describe('unconfigured storage (production while credentials are pending)', () => {
  it('is what the app gets with the current template values, and fails every call clearly', async () => {
    const saved = { ...process.env };
    try {
      Object.assign(process.env, { R2_ACCOUNT_ID: 'your_account_id' });
      const storage = getStorage();
      expect(storage.kind).toBe('unconfigured');
      expect(getStorageStatus().configured).toBe(false);
      await expect(storage.head('reports/x.pdf')).rejects.toBeInstanceOf(StorageNotConfiguredError);
      await expect(storage.createUploadUrl({ key: 'k', contentType: 'application/pdf', contentLength: 1, expiresInSeconds: 60 })).rejects.toThrow(/not configured/);
    } finally {
      process.env = saved;
    }
  });
});

describe('R2 adapter — offline signing (no network)', () => {
  const config = readR2Config(FAKE);
  if (!config.ok) throw new Error('fixture config invalid');
  const r2 = new R2Storage(config.config);

  it('signs uploads for exactly one key, size and type, expiring in 5 minutes', async () => {
    const up = await r2.createUploadUrl({ key: 'pending/a/b.pdf', contentType: 'application/pdf', contentLength: 12345, expiresInSeconds: 300 });
    const url = new URL(up.url);
    expect(url.origin).toBe(`https://${FAKE.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`);
    expect(url.pathname).toBe('/test-pdf-bucket/pending/a/b.pdf');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-SignedHeaders')?.split(';')).toEqual(expect.arrayContaining(['content-length', 'content-type', 'host']));
    expect(up.method).toBe('PUT');
    expect(up.headers).toEqual({ 'Content-Type': 'application/pdf' });
  });

  it('does not add a checksum the browser could not supply (the SDK default that breaks R2 uploads)', async () => {
    const up = await r2.createUploadUrl({ key: 'pending/a/b.pdf', contentType: 'application/pdf', contentLength: 10, expiresInSeconds: 300 });
    expect(up.url.toLowerCase()).not.toMatch(/x-amz-checksum|x-amz-sdk-checksum/);
  });

  it('never puts the secret in a URL', async () => {
    const up = await r2.createUploadUrl({ key: 'pending/a/b.pdf', contentType: 'application/pdf', contentLength: 10, expiresInSeconds: 300 });
    const down = await r2.createDownloadUrl({ key: 'reports/x.pdf', fileName: 'x.pdf', disposition: 'inline', expiresInSeconds: 600 });
    for (const u of [up.url, down.url]) expect(u).not.toContain(FAKE.R2_SECRET_ACCESS_KEY);
  });

  it('signs downloads with the PDF type and a safe download name', async () => {
    const down = await r2.createDownloadUrl({ key: 'reports/x.pdf', fileName: 'Weekly "Report".pdf', disposition: 'attachment', expiresInSeconds: 300 });
    const url = new URL(down.url);
    expect(url.searchParams.get('response-content-type')).toBe('application/pdf');
    expect(url.searchParams.get('response-content-disposition')).toMatch(/^attachment; filename="Weekly Report.pdf"/);
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
  });
});

describe('memory storage models R2 upload rules', () => {
  it('refuses expired URLs and mismatched sizes or types', async () => {
    const s = new MemoryStorage();
    let t = 1_000_000;
    s.now = () => t;
    const up = await s.createUploadUrl({ key: 'pending/a/b.pdf', contentType: 'application/pdf', contentLength: 2048, expiresInSeconds: 300 });
    await expect(s.simulateBrowserUpload(up.url, fakePdf(4096))).rejects.toThrow(/content-length/);
    await expect(s.simulateBrowserUpload(up.url, fakePdf(2048), 'text/html')).rejects.toThrow(/content-type/);
    t += 301_000;
    await expect(s.simulateBrowserUpload(up.url, fakePdf(2048))).rejects.toThrow(/expired/);
    expect(s.keys()).toEqual([]);
  });
});

describe('no test double can reach production code', () => {
  it('nothing under src/ imports from tests/ or the memory adapter', () => {
    const offenders: string[] = [];
    const walk = (dir: string) => {
      for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
          if (entry !== 'generated') walk(full);
        } else if (/\.(ts|tsx)$/.test(entry) && /from ['"][^'"]*(tests\/|memory-storage)/.test(readFileSync(full, 'utf8'))) {
          offenders.push(full);
        }
      }
    };
    walk('src');
    expect(offenders).toEqual([]);
  });

  it('there is no filesystem storage adapter in src/', () => {
    const storageDir = readdirSync('src/lib/server/storage');
    for (const file of storageDir) expect(readFileSync(join('src/lib/server/storage', file), 'utf8')).not.toMatch(/from ['"](node:)?fs(\/promises)?['"]/);
  });
});

import 'server-only';
import {
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { contentDisposition } from '../reports/content-disposition';
import type { R2Config } from './config';
import { StorageError, type PresignedDownload, type PresignedUpload, type ReportStorage, type StoredObjectInfo } from './types';

// ============================================================================
// Cloudflare R2, through its S3-compatible API.
//
// The bucket is private: every read and write goes through a short-lived
// signed URL or a server-side call. Nothing here is ever sent to a browser
// except the signed URLs themselves.
//
// STATUS: written and tested offline (URL signing, headers, expiry). Live
// behaviour against a real bucket is pending R2 credentials.
// ============================================================================

function statusOf(error: unknown): number | undefined {
  return (error as { $metadata?: { httpStatusCode?: number } })?.$metadata?.httpStatusCode;
}

function isNotFound(error: unknown): boolean {
  const name = (error as { name?: string })?.name;
  return name === 'NotFound' || name === 'NoSuchKey' || statusOf(error) === 404;
}

export class R2Storage implements ReportStorage {
  readonly kind = 'r2' as const;
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: R2Config) {
    this.bucket = config.bucket;
    this.client = new S3Client({
      region: 'auto',
      endpoint: config.endpoint,
      // Path-style keeps the bucket name out of the TLS host name.
      forcePathStyle: true,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
      // Recent SDK versions add a CRC32 checksum to presigned PUT URLs by
      // default; a browser upload cannot supply it and R2 then rejects the
      // request. Only compute checksums where an operation requires one.
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
    });
  }

  private async run<T>(operation: string, fn: () => Promise<T>): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof StorageError) throw error;
      const status = statusOf(error);
      const name = (error as { name?: string })?.name ?? 'Error';
      throw new StorageError(operation, `R2 ${operation} failed (${name}${status ? ` ${status}` : ''})`, status);
    }
  }

  async createUploadUrl(input: { key: string; contentType: string; contentLength: number; expiresInSeconds: number }): Promise<PresignedUpload> {
    return this.run('presign-upload', async () => {
      const command = new PutObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ContentType: input.contentType,
        ContentLength: input.contentLength,
      });
      // Signing content-type and content-length means R2 accepts only an upload
      // of exactly this size and type — the 50 MB limit is enforced by R2
      // itself, not just by the browser.
      const url = await getSignedUrl(this.client, command, {
        expiresIn: input.expiresInSeconds,
        signableHeaders: new Set(['content-type', 'content-length']),
      });
      return {
        url,
        method: 'PUT',
        headers: { 'Content-Type': input.contentType },
        expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000),
      };
    });
  }

  async createDownloadUrl(input: { key: string; fileName: string; disposition: 'inline' | 'attachment'; expiresInSeconds: number }): Promise<PresignedDownload> {
    return this.run('presign-download', async () => {
      const command = new GetObjectCommand({
        Bucket: this.bucket,
        Key: input.key,
        ResponseContentDisposition: contentDisposition(input.disposition, input.fileName),
        ResponseContentType: 'application/pdf',
      });
      const url = await getSignedUrl(this.client, command, { expiresIn: input.expiresInSeconds });
      return { url, expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000) };
    });
  }

  async head(key: string): Promise<StoredObjectInfo | null> {
    try {
      const out = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key }));
      return { size: Number(out.ContentLength ?? 0), contentType: out.ContentType ?? null };
    } catch (error) {
      if (isNotFound(error)) return null;
      return this.run('head', () => Promise.reject(error));
    }
  }

  async readStart(key: string, bytes: number): Promise<Uint8Array> {
    return this.run('read', async () => {
      const out = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: key, Range: `bytes=0-${Math.max(0, bytes - 1)}` }));
      if (!out.Body) return new Uint8Array();
      return (await out.Body.transformToByteArray()).slice(0, bytes);
    });
  }

  async copy(sourceKey: string, destinationKey: string): Promise<void> {
    await this.run('copy', async () => {
      await this.client.send(
        new CopyObjectCommand({
          Bucket: this.bucket,
          Key: destinationKey,
          CopySource: `${this.bucket}/${sourceKey.split('/').map(encodeURIComponent).join('/')}`,
        }),
      );
    });
  }

  async delete(key: string): Promise<void> {
    await this.run('delete', async () => {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
    });
  }

  async list(prefix: string): Promise<{ key: string; lastModified: Date | null; size: number }[]> {
    return this.run('list', async () => {
      const out: { key: string; lastModified: Date | null; size: number }[] = [];
      let token: string | undefined;
      do {
        const page = await this.client.send(new ListObjectsV2Command({ Bucket: this.bucket, Prefix: prefix, ContinuationToken: token }));
        for (const o of page.Contents ?? []) if (o.Key) out.push({ key: o.Key, lastModified: o.LastModified ?? null, size: Number(o.Size ?? 0) });
        token = page.IsTruncated ? page.NextContinuationToken : undefined;
      } while (token);
      return out;
    });
  }
}

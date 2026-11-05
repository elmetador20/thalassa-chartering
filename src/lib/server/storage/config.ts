import 'server-only';

// R2 configuration, read from the environment. Server-only: none of these is
// NEXT_PUBLIC_, so Next.js never inlines them into browser code.
//
//   R2_ACCOUNT_ID         32 hex characters
//   R2_ACCESS_KEY_ID      32 hex characters (API token access key)
//   R2_SECRET_ACCESS_KEY  64 hex characters (API token secret)
//   R2_BUCKET_NAME        the private bucket
//   R2_ENDPOINT           optional — only for a jurisdiction endpoint
//                         (https://<account-id>.eu.r2.cloudflarestorage.com);
//                         otherwise derived from the account id
//
// Template values ("your_account_id") and malformed values count as missing,
// so the app fails closed instead of trying to sign requests with them.

export interface R2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  endpoint: string;
}

export type R2ConfigResult = { ok: true; config: R2Config } | { ok: false; reason: string };

const RULES: { name: string; pattern: RegExp; description: string }[] = [
  { name: 'R2_ACCOUNT_ID', pattern: /^[0-9a-f]{32}$/, description: '32 hex characters' },
  { name: 'R2_ACCESS_KEY_ID', pattern: /^[0-9a-f]{32}$/, description: '32 hex characters' },
  { name: 'R2_SECRET_ACCESS_KEY', pattern: /^[0-9a-f]{64}$/, description: '64 hex characters' },
  { name: 'R2_BUCKET_NAME', pattern: /^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/, description: 'a valid bucket name' },
];

export function readR2Config(env: Record<string, string | undefined> = process.env): R2ConfigResult {
  const problems: string[] = [];
  const values: Record<string, string> = {};
  for (const rule of RULES) {
    const value = env[rule.name]?.trim();
    if (!value) problems.push(`${rule.name} is not set`);
    else if (!rule.pattern.test(value)) problems.push(`${rule.name} is not ${rule.description}`);
    else values[rule.name] = value;
  }
  if (problems.length) return { ok: false, reason: problems.join('; ') };

  const accountId = values.R2_ACCOUNT_ID;
  const standard = `https://${accountId}.r2.cloudflarestorage.com`;
  const custom = env.R2_ENDPOINT?.trim().replace(/\/+$/, '');
  const jurisdiction = new RegExp(`^https://${accountId}\\.(?:[a-z]{2,10}\\.)?r2\\.cloudflarestorage\\.com$`);
  return {
    ok: true,
    config: {
      accountId,
      accessKeyId: values.R2_ACCESS_KEY_ID,
      secretAccessKey: values.R2_SECRET_ACCESS_KEY,
      bucket: values.R2_BUCKET_NAME,
      // A stale or template R2_ENDPOINT is ignored rather than trusted.
      endpoint: custom && jurisdiction.test(custom) ? custom : standard,
    },
  };
}

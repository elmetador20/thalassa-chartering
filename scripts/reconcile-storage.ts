/**
 * Compares the R2 bucket with the reports table and prints what does not
 * line up. DRY RUN by default: nothing is changed.
 *
 *   npm run storage:reconcile                        # report only
 *   npm run storage:reconcile -- --delete-stale-uploads
 *       also deletes pending/ uploads older than 24 h (started, never saved)
 *
 * Report files (reports/…) are never deleted by this script, even orphaned
 * ones — they are listed so a person can check the audit log first.
 * Prints object keys and report titles only; never credentials.
 */
import { loadEnvConfig } from '@next/env';
import { describeErrorSafely } from '../src/lib/server/safe-error';

loadEnvConfig(process.cwd());

async function main() {
  const deleteStale = process.argv.includes('--delete-stale-uploads');
  const { getStorage, getStorageStatus } = await import('../src/lib/server/storage');
  const { reconcileStorage } = await import('../src/lib/server/storage/reconcile');

  const status = getStorageStatus();
  if (!status.configured) {
    console.error(`R2 storage is not configured: ${status.reason}`);
    process.exitCode = 2;
    return;
  }

  const r = await reconcileStorage({ storage: getStorage(), deleteStaleUploads: deleteStale });
  const mb = (n: number) => `${(n / 1024 / 1024).toFixed(2)} MB`;

  console.log(`Mode: ${r.dryRun ? 'DRY RUN (nothing changed)' : 'deleting stale uploads'}`);
  console.log(`Checked ${r.checkedObjects} objects and ${r.checkedReports} reports.\n`);

  console.log(`Orphaned report files (in storage, no report): ${r.orphanedFiles.length}`);
  for (const o of r.orphanedFiles) console.log(`  ${o.key}  ${mb(o.size)}  ${o.lastModified ?? ''}`);

  console.log(`\nReports whose PDF is missing from storage: ${r.missingFiles.length}`);
  for (const m of r.missingFiles) console.log(`  ${m.status.padEnd(9)} ${m.title}  (${m.fileKey}, report ${m.reportId})`);

  console.log(`\nStale temporary uploads (older than 24 h): ${r.staleUploads.length}`);
  for (const s of r.staleUploads) console.log(`  ${s.key}  ${mb(s.size)}  ${s.lastModified ?? ''}`);
  if (!r.dryRun) console.log(`Deleted ${r.deletedUploads} stale upload(s).`);
  for (const f of r.failedDeletes) console.log(`  could not delete ${f}`);

  if (r.dryRun && r.staleUploads.length) console.log('\nRe-run with --delete-stale-uploads to remove the stale uploads.');
  if (r.orphanedFiles.length) console.log('Orphaned report files are never deleted automatically. Check REPORT_DELETED / REPORT_FILE_REPLACED in the audit log first.');
}

main()
  .catch((error) => {
    console.error(`Reconciliation failed: ${describeErrorSafely(error)}`);
    process.exitCode = 1;
  })
  .finally(async () => {
    const { getDb } = await import('../src/lib/server/db');
    await getDb().$disconnect();
  });

'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import styled from 'styled-components';
import { CATEGORY_LABELS, formatCalendarDate } from '@/lib/admin-format';
import {
  describeFieldErrors,
  duplicateFingerprint,
  IMPORT_TEMPLATE_CSV,
  importErrorsCsv,
  MAX_IMPORT_CSV_BYTES,
  MAX_IMPORT_ROWS,
  parseImportCsv,
  validateImportRow,
  type ExistingReportRef,
  type ImportRow,
  type RawImportRow,
} from '@/lib/reports/bulk-import';
import { formatFileSize } from '@/lib/reports/constants';
import { checkImportRows, downloadTextFile, ImportApiError, importOneRow, runPool } from '@/lib/reports/import-client';
import { precheckPdf } from '@/lib/reports/upload-client';
import { LinkButton } from './LinkButton';
import { Alert, Badge, Button, Muted, Panel, PanelHeader, PanelTitle, ResponsiveTable, Stack, Stat, StatGrid, Strong, Sub } from './ui';

// ============================================================================
// Bulk import: one CSV + many PDFs → preview → import → results.
//
// Files are matched to rows by the exact `fileName` column. Every row is
// checked in the browser AND on the server before anything is uploaded;
// invalid rows are listed, never silently dropped; possible duplicates are
// skipped unless the admin ticks "Import anyway". Rows are imported a few at
// a time (batch size set on the server), each through the same verified path
// as a single upload, and a retried row can never create a second report.
// ============================================================================

type Phase = 'select' | 'checking' | 'review' | 'importing' | 'done';
type RunState = 'pending' | 'queued' | 'uploading' | 'saving' | 'imported' | 'already' | 'failed' | 'skipped';

interface Entry {
  raw: RawImportRow;
  row: ImportRow | null;
  file: File | null;
  /** Errors: the row cannot be imported until they are fixed. */
  problems: string[];
  /** Information that does not block the row. */
  notes: string[];
  duplicates: ExistingReportRef[];
  alreadyImported: ExistingReportRef | null;
  include: boolean;
  run: RunState;
  progress: number;
  message: string | null;
  report: { id: string; slug: string } | null;
}

const importable = (e: Entry) => Boolean(e.row && e.file && e.problems.length === 0 && !e.alreadyImported && (e.duplicates.length === 0 || e.include));

// ------------------------------------------------------------------ styles --

const Grid2 = styled.div`
  display: grid;
  gap: 20px;
  @media (min-width: 1000px) {
    grid-template-columns: minmax(0, 1fr) minmax(0, 1.4fr);
    align-items: start;
  }
`;

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  align-items: center;
`;

const Columns = styled.table`
  width: 100%;
  border-collapse: collapse;
  font-size: 13.5px;
  th,
  td {
    text-align: left;
    padding: 7px 10px 7px 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnLightSoft};
    vertical-align: top;
  }
  th {
    font-weight: 500;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
  code {
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 12.5px;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
`;

const Drop = styled.div<{ $drag: boolean; $disabled: boolean }>`
  display: grid;
  place-items: center;
  gap: 12px;
  min-height: 170px;
  padding: 24px 18px;
  text-align: center;
  border: 1.5px dashed ${({ $drag, theme }) => ($drag ? theme.colors.navy : '#7A8C9E')};
  background: ${({ $drag, theme }) => ($drag ? theme.colors.infoSoft : theme.colors.offWhite)};
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};

  strong {
    font-size: 15.5px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
  p {
    font-size: 13.5px;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
`;

const HiddenInput = styled.input`
  position: absolute;
  width: 1px;
  height: 1px;
  opacity: 0;
  pointer-events: none;
`;

const Chosen = styled.dl`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto;
  gap: 10px 14px;
  align-items: center;
  font-size: 14px;

  dt {
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
  dd {
    margin: 0;
    color: ${({ theme }) => theme.colors.textOnLight};
    overflow-wrap: anywhere;
  }
`;

const LinkLike = styled.button`
  font-size: 13.5px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.navy};
  text-decoration: underline;
  text-underline-offset: 3px;
  cursor: pointer;
`;

const Bar = styled.div`
  display: grid;
  gap: 6px;
  font-size: 14px;
  color: ${({ theme }) => theme.colors.bodyOnLight};

  .track {
    height: 8px;
    background: ${({ theme }) => theme.colors.neutralSoft};
    overflow: hidden;
  }
  .fill {
    height: 100%;
    background: ${({ theme }) => theme.colors.navy};
    transition: width 0.3s ease;
  }
`;

const RowNote = styled.span<{ $tone?: 'danger' | 'muted' }>`
  display: block;
  margin-top: 4px;
  font-size: 13px;
  line-height: 1.45;
  color: ${({ $tone, theme }) => ($tone === 'danger' ? theme.colors.danger : theme.colors.mutedOnLight)};
  overflow-wrap: anywhere;

  a {
    color: ${({ theme }) => theme.colors.navy};
    text-decoration: underline;
  }
  label {
    display: inline-flex;
    gap: 6px;
    align-items: center;
    margin-top: 4px;
    color: ${({ theme }) => theme.colors.textOnLight};
    cursor: pointer;
  }
`;

const StatFive = styled(StatGrid)`
  @media (min-width: 760px) {
    grid-template-columns: repeat(5, minmax(0, 1fr));
  }
`;

// --------------------------------------------------------------- helpers --

function classify(files: File[]) {
  const csv: File[] = [];
  const pdfs: File[] = [];
  const ignored: File[] = [];
  for (const f of files) {
    if (/\.csv$/i.test(f.name)) csv.push(f);
    else if (/\.pdf$/i.test(f.name) || f.type === 'application/pdf') pdfs.push(f);
    else ignored.push(f);
  }
  return { csv, pdfs, ignored };
}

const sameFile = (a: File, b: File) => a.name === b.name && a.size === b.size && a.lastModified === b.lastModified;

function buildEntries(rows: RawImportRow[], pdfs: File[]): Entry[] {
  const byName = new Map<string, File[]>();
  const byLower = new Map<string, string>();
  for (const f of pdfs) {
    byName.set(f.name, [...(byName.get(f.name) ?? []), f]);
    byLower.set(f.name.toLowerCase(), f.name);
  }
  const rowsByFile = new Map<string, number[]>();
  for (const r of rows) if (r.fileName) rowsByFile.set(r.fileName, [...(rowsByFile.get(r.fileName) ?? []), r.rowNumber]);
  const firstWithFingerprint = new Map<string, number>();

  return rows.map((raw) => {
    const checked = validateImportRow(raw);
    const problems = checked.errors ? [describeFieldErrors(checked.errors)] : [];
    const notes: string[] = [];
    let file: File | null = null;

    if (raw.fileName) {
      const sharing = (rowsByFile.get(raw.fileName) ?? []).filter((n) => n !== raw.rowNumber);
      if (sharing.length) problems.push(`Duplicate filename: “${raw.fileName}” is also listed in row ${sharing.join(', ')}.`);
      const matches = byName.get(raw.fileName) ?? [];
      if (matches.length === 0) {
        const near = byLower.get(raw.fileName.toLowerCase());
        problems.push(
          near
            ? `Missing PDF: no file named exactly “${raw.fileName}” (found “${near}” — names must match exactly).`
            : `Missing PDF: no uploaded file is named “${raw.fileName}”.`,
        );
      } else if (matches.length > 1) {
        problems.push(`Duplicate filename: ${matches.length} uploaded files are named “${raw.fileName}”.`);
      } else {
        file = matches[0];
      }
    }

    if (checked.row) {
      const fp = duplicateFingerprint(checked.row.title, checked.row.reportDate);
      const first = firstWithFingerprint.get(fp);
      if (first) notes.push(`Same title and date as row ${first}.`);
      else firstWithFingerprint.set(fp, raw.rowNumber);
    }

    return {
      raw,
      row: checked.row,
      file,
      problems,
      notes,
      duplicates: [],
      alreadyImported: null,
      include: false,
      run: 'pending',
      progress: 0,
      message: null,
      report: null,
    };
  });
}

function todayStamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// -------------------------------------------------------------- component --

interface Props {
  batchSize: number;
  storageReady: boolean;
  canPublish: boolean;
}

export default function BulkImportWorkspace({ batchSize, storageReady, canPublish }: Props) {
  const [phase, setPhase] = useState<Phase>('select');
  const [csvFile, setCsvFile] = useState<File | null>(null);
  const [pdfs, setPdfs] = useState<File[]>([]);
  const [ignored, setIgnored] = useState<string[]>([]);
  const [selectError, setSelectError] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [serverStorage, setServerStorage] = useState(storageReady);
  const [onlyProblems, setOnlyProblems] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const [drag, setDrag] = useState(false);
  const [stopReason, setStopReason] = useState<string | null>(null);
  const [runRows, setRunRows] = useState<Set<number>>(new Set());
  const stopRef = useRef(false);
  const abortRef = useRef<AbortController | null>(null);
  const csvInput = useRef<HTMLInputElement>(null);
  const pdfInput = useRef<HTMLInputElement>(null);
  const folderInput = useRef<HTMLInputElement>(null);

  const busy = phase === 'checking' || phase === 'importing';

  useEffect(() => {
    if (phase !== 'importing') return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [phase]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const patch = useCallback((rowNumber: number, change: Partial<Entry>) => {
    setEntries((list) => list.map((e) => (e.raw.rowNumber === rowNumber ? { ...e, ...change } : e)));
  }, []);

  // ------------------------------------------------------------ files --

  function addFiles(list: FileList | File[] | null) {
    if (!list) return;
    const { csv, pdfs: newPdfs, ignored: skip } = classify([...list]);
    setSelectError(null);
    if (csv.length > 1) setSelectError('Choose one CSV file per import.');
    else if (csv.length === 1) {
      if (csv[0].size > MAX_IMPORT_CSV_BYTES) setSelectError('The CSV is larger than 2 MB. Split it into several imports.');
      else setCsvFile(csv[0]);
    }
    if (newPdfs.length) setPdfs((current) => [...current, ...newPdfs.filter((f) => !current.some((c) => sameFile(c, f)))]);
    if (skip.length) setIgnored((current) => [...current, ...skip.map((f) => f.name)].slice(-20));
  }

  function resetAll() {
    abortRef.current?.abort();
    setPhase('select');
    setCsvFile(null);
    setPdfs([]);
    setIgnored([]);
    setEntries([]);
    setSelectError(null);
    setStopReason(null);
    setOnlyProblems(false);
    setShowAll(false);
  }

  // ----------------------------------------------------------- review --

  async function review() {
    if (!csvFile) return setSelectError('Choose the CSV file first.');
    setSelectError(null);
    setPhase('checking');
    try {
      const parsed = parseImportCsv(await csvFile.text());
      if (parsed.error) {
        setSelectError(parsed.error);
        return setPhase('select');
      }
      const built = buildEntries(parsed.rows, pdfs);

      // Read each matched PDF's first bytes (type, size, signature).
      await Promise.all(
        built.map(async (e) => {
          if (!e.file) return;
          const problem = await precheckPdf(e.file);
          if (problem) e.problems.push(problem === 'This file is not a valid PDF.' ? 'Invalid PDF: the file is not a PDF document.' : problem);
        }),
      );

      // The server re-validates every row and looks for earlier imports and
      // existing reports with the same title and date.
      const toCheck = built
        .filter((e) => e.row)
        .map((e) => ({ ...e.row!, fileSize: e.file && e.problems.length === 0 ? e.file.size : undefined }));
      if (toCheck.length) {
        const { results, storageConfigured } = await checkImportRows(toCheck);
        setServerStorage(storageConfigured);
        const byRow = new Map(results.map((r) => [r.rowNumber, r]));
        for (const e of built) {
          const r = byRow.get(e.raw.rowNumber);
          if (!r) continue;
          if (r.error) e.problems.push(r.error);
          e.alreadyImported = r.alreadyImported;
          e.duplicates = r.possibleDuplicates;
        }
      }
      setEntries(built);
      setShowAll(built.length <= 200);
      setPhase('review');
    } catch (error) {
      setSelectError(error instanceof ImportApiError ? error.message : 'The CSV could not be checked. Please try again.');
      setPhase('select');
    }
  }

  // ----------------------------------------------------------- import --

  async function runImport(rowNumbers: number[]) {
    stopRef.current = false;
    setStopReason(null);
    abortRef.current = new AbortController();
    const signal = abortRef.current.signal;
    const queue = new Set(rowNumbers);
    setRunRows(queue);

    setEntries((list) =>
      list.map((e) => {
        if (queue.has(e.raw.rowNumber)) return { ...e, run: 'queued', progress: 0, message: null };
        if (e.run !== 'pending') return e; // results of an earlier pass stay
        if (e.problems.length) return { ...e, run: 'failed', message: e.problems.join(' ') };
        if (e.alreadyImported) return { ...e, run: 'already', report: e.alreadyImported, message: 'Imported earlier — not imported again.' };
        if (e.duplicates.length && !e.include) return { ...e, run: 'skipped', message: 'Possible duplicate of an existing report — skipped.' };
        return e;
      }),
    );
    setPhase('importing');

    const byRow = new Map(entries.map((e) => [e.raw.rowNumber, e]));
    await runPool(
      rowNumbers,
      batchSize,
      async (rowNumber) => {
        const entry = byRow.get(rowNumber)!;
        let lastPercent = -1;
        patch(rowNumber, { run: 'uploading', progress: 0 });
        try {
          const outcome = await importOneRow(entry.row!, entry.file!, {
            signal,
            onUploadProgress: (fraction) => {
              const percent = Math.floor(fraction * 100);
              if (percent !== lastPercent) {
                lastPercent = percent;
                patch(rowNumber, { progress: fraction });
              }
            },
            onSaving: () => patch(rowNumber, { run: 'saving', progress: 1 }),
          });
          patch(rowNumber, {
            run: outcome.state,
            report: outcome.report,
            message: outcome.state === 'already' ? 'Imported earlier — not imported again.' : null,
          });
        } catch (error) {
          const message = error instanceof ImportApiError ? error.message : 'Something went wrong with this row.';
          patch(rowNumber, { run: 'failed', message });
          if (error instanceof ImportApiError && error.fatal) {
            stopRef.current = true;
            setStopReason(message);
          }
        }
      },
      () => stopRef.current,
    );

    setEntries((list) => list.map((e) => (e.run === 'queued' ? { ...e, run: 'skipped', message: 'Not started — the import was stopped.' } : e)));
    abortRef.current = null;
    setPhase('done');
  }

  function startImport() {
    void runImport(entries.filter(importable).map((e) => e.raw.rowNumber));
  }

  function retryFailed() {
    // Only rows that failed during the import; invalid rows need fixing first.
    void runImport(entries.filter((e) => e.run === 'failed' && importable(e)).map((e) => e.raw.rowNumber));
  }

  // ----------------------------------------------------------- derived --

  const counts = useMemo(() => {
    const c = { total: entries.length, ready: 0, errors: 0, duplicates: 0, already: 0, imported: 0, failed: 0, skipped: 0, queued: 0, done: 0 };
    for (const e of entries) {
      if (e.problems.length) c.errors++;
      if (e.duplicates.length) c.duplicates++;
      if (e.alreadyImported) c.already++;
      if (importable(e)) c.ready++;
      if (e.run === 'imported') c.imported++;
      if (e.run === 'failed') c.failed++;
      if (e.run === 'skipped' || e.run === 'already') c.skipped++;
      if (e.run === 'queued' || e.run === 'uploading' || e.run === 'saving') c.queued++;
    }
    return c;
  }, [entries]);

  const progress = useMemo(() => {
    let done = 0;
    let total = 0;
    let sent = 0;
    for (const e of entries) {
      if (!runRows.has(e.raw.rowNumber) || !e.file) continue;
      const active = e.run === 'queued' || e.run === 'uploading' || e.run === 'saving';
      if (!active) done++;
      total += e.file.size;
      sent += e.run === 'uploading' ? e.file.size * e.progress : e.run === 'queued' ? 0 : e.file.size;
    }
    return { done, rows: runRows.size, total, sent };
  }, [entries, runRows]);

  const usedNames = useMemo(() => new Set(entries.map((e) => e.raw.fileName)), [entries]);
  const unusedPdfs = phase === 'review' ? pdfs.filter((f) => !usedNames.has(f.name)) : [];

  const visible = useMemo(() => {
    const list = onlyProblems ? entries.filter((e) => e.problems.length || e.duplicates.length || e.notes.length || e.run === 'failed') : entries;
    return showAll ? list : list.slice(0, 200);
  }, [entries, onlyProblems, showAll]);

  function downloadErrors() {
    const lines = entries
      .filter((e) => e.run === 'failed' || e.run === 'skipped' || (phase === 'review' && e.problems.length))
      .map((e) => ({ rowNumber: e.raw.rowNumber, fileName: e.raw.fileName, title: e.raw.title, reason: e.message ?? e.problems.join(' ') }));
    downloadTextFile(`report-import-errors-${todayStamp()}.csv`, importErrorsCsv(lines));
  }

  // ------------------------------------------------------------ render --

  const storageNote = !serverStorage && (
    <Alert tone="info">
      PDF storage (Cloudflare R2) is not configured yet, so the import cannot be completed. You can still check a CSV and its PDFs here; importing
      becomes available as soon as storage is connected.
    </Alert>
  );

  return (
    <Stack $gap={20}>
      {storageNote}

      {(phase === 'select' || phase === 'checking') && (
        <Grid2>
          <Panel aria-labelledby="tpl-heading">
            <PanelHeader>
              <PanelTitle id="tpl-heading">1. Prepare the CSV</PanelTitle>
            </PanelHeader>
            <Stack $gap={14}>
              <Muted>One row per report. Each row names its PDF in the fileName column, exactly as the file is named.</Muted>
              <Columns>
                <thead>
                  <tr>
                    <th scope="col">Column</th>
                    <th scope="col">Required</th>
                    <th scope="col">Format</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><code>title</code></td>
                    <td>Yes</td>
                    <td>Up to 300 characters</td>
                  </tr>
                  <tr>
                    <td><code>category</code></td>
                    <td>Yes</td>
                    <td>Global, Domestic or Special</td>
                  </tr>
                  <tr>
                    <td><code>reportDate</code></td>
                    <td>Yes</td>
                    <td>YYYY-MM-DD, from 2000-01-01 to today</td>
                  </tr>
                  <tr>
                    <td><code>description</code></td>
                    <td>No</td>
                    <td>Up to 2,000 characters</td>
                  </tr>
                  <tr>
                    <td><code>fileName</code></td>
                    <td>Yes</td>
                    <td>The PDF’s exact file name, e.g. outlook.pdf</td>
                  </tr>
                  <tr>
                    <td><code>status</code></td>
                    <td>Yes</td>
                    <td>{canPublish ? 'Draft or Published' : 'Draft'}</td>
                  </tr>
                </tbody>
              </Columns>
              <Muted>
                Up to {MAX_IMPORT_ROWS.toLocaleString('en-IN')} rows per import, PDFs up to 50 MB each. Existing reports are never changed.
              </Muted>
              <Actions>
                <Button type="button" $variant="secondary" onClick={() => downloadTextFile('report-import-template.csv', IMPORT_TEMPLATE_CSV)}>
                  Download CSV template
                </Button>
              </Actions>
            </Stack>
          </Panel>

          <Panel aria-labelledby="files-heading">
            <PanelHeader>
              <PanelTitle id="files-heading">2. Add the CSV and the PDFs</PanelTitle>
            </PanelHeader>
            <Stack $gap={16}>
              {selectError && <Alert tone="error">{selectError}</Alert>}
              <Drop
                $drag={drag}
                $disabled={busy}
                onDragOver={(e) => {
                  if (busy) return;
                  e.preventDefault();
                  setDrag(true);
                }}
                onDragLeave={() => setDrag(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDrag(false);
                  if (!busy) addFiles(e.dataTransfer.files);
                }}
              >
                <div>
                  <strong>Drop the CSV and all the PDFs here</strong>
                  <p>or choose them</p>
                </div>
                <Actions style={{ justifyContent: 'center' }}>
                  <Button type="button" $small $variant="secondary" disabled={busy} onClick={() => csvInput.current?.click()}>
                    Choose CSV
                  </Button>
                  <Button type="button" $small $variant="secondary" disabled={busy} onClick={() => pdfInput.current?.click()}>
                    Choose PDFs
                  </Button>
                  <Button type="button" $small $variant="secondary" disabled={busy} onClick={() => folderInput.current?.click()}>
                    Choose a folder
                  </Button>
                </Actions>
                <HiddenInput
                  ref={csvInput}
                  type="file"
                  accept=".csv,text/csv"
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <HiddenInput
                  ref={pdfInput}
                  type="file"
                  accept=".pdf,application/pdf"
                  multiple
                  tabIndex={-1}
                  aria-hidden
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
                <HiddenInput
                  ref={folderInput}
                  type="file"
                  multiple
                  tabIndex={-1}
                  aria-hidden
                  {...({ webkitdirectory: '' } as Record<string, string>)}
                  onChange={(e) => {
                    addFiles(e.target.files);
                    e.target.value = '';
                  }}
                />
              </Drop>

              <Chosen>
                <dt>CSV</dt>
                <dd>{csvFile ? `${csvFile.name} · ${formatFileSize(csvFile.size)}` : 'None chosen'}</dd>
                {csvFile ? (
                  <LinkLike type="button" disabled={busy} onClick={() => setCsvFile(null)}>
                    Remove
                  </LinkLike>
                ) : (
                  <span />
                )}
                <dt>PDFs</dt>
                <dd>
                  {pdfs.length
                    ? `${pdfs.length.toLocaleString('en-IN')} file${pdfs.length === 1 ? '' : 's'} · ${formatFileSize(pdfs.reduce((s, f) => s + f.size, 0))}`
                    : 'None chosen'}
                </dd>
                {pdfs.length ? (
                  <LinkLike type="button" disabled={busy} onClick={() => setPdfs([])}>
                    Clear
                  </LinkLike>
                ) : (
                  <span />
                )}
              </Chosen>
              {ignored.length > 0 && (
                <Muted>
                  Ignored {ignored.length} file{ignored.length === 1 ? '' : 's'} that {ignored.length === 1 ? 'is' : 'are'} not a PDF or CSV:{' '}
                  {ignored.slice(0, 5).join(', ')}
                  {ignored.length > 5 ? '…' : ''}
                </Muted>
              )}

              <Actions>
                <Button type="button" disabled={!csvFile || busy} onClick={() => void review()}>
                  {phase === 'checking' ? 'Checking…' : 'Review import'}
                </Button>
                {(csvFile || pdfs.length > 0) && (
                  <Button type="button" $variant="secondary" disabled={busy} onClick={resetAll}>
                    Start over
                  </Button>
                )}
              </Actions>
            </Stack>
          </Panel>
        </Grid2>
      )}

      {phase !== 'select' && phase !== 'checking' && (
        <>
          {phase === 'review' ? (
            <Panel aria-labelledby="review-heading">
              <PanelHeader>
                <PanelTitle id="review-heading">3. Review</PanelTitle>
                <Muted>{csvFile?.name}</Muted>
              </PanelHeader>
              <Stack $gap={16}>
                <StatFive>
                  <Stat value={counts.total} label="Rows in the CSV" />
                  <Stat value={counts.ready} label="Ready to import" />
                  <Stat value={counts.errors} label="With errors" highlight={counts.errors > 0} />
                  <Stat value={counts.duplicates} label="Possible duplicates" highlight={counts.duplicates > 0} />
                  <Stat value={counts.already} label="Imported earlier" />
                </StatFive>
                {counts.errors > 0 && (
                  <Alert tone="error">
                    {counts.errors} row{counts.errors === 1 ? ' has' : 's have'} errors and will not be imported. Fix them in the CSV (or add the missing
                    PDFs) and review again, or import the valid rows now and the rest later.
                  </Alert>
                )}
                {counts.duplicates > 0 && (
                  <Alert tone="info">
                    {counts.duplicates} row{counts.duplicates === 1 ? ' looks' : 's look'} like {counts.duplicates === 1 ? 'a report' : 'reports'} that
                    already exist (same title and date). They are skipped unless you tick “Import anyway”. Existing reports are never changed.
                  </Alert>
                )}
                {unusedPdfs.length > 0 && (
                  <Muted>
                    {unusedPdfs.length} PDF{unusedPdfs.length === 1 ? ' is' : 's are'} not named in the CSV and will not be imported:{' '}
                    {unusedPdfs.slice(0, 5).map((f) => f.name).join(', ')}
                    {unusedPdfs.length > 5 ? '…' : ''}
                  </Muted>
                )}
                <Actions>
                  <Button type="button" $variant="success" disabled={counts.ready === 0 || !serverStorage} onClick={startImport}>
                    Import {counts.ready.toLocaleString('en-IN')} valid report{counts.ready === 1 ? '' : 's'}
                  </Button>
                  <Button type="button" $variant="secondary" onClick={() => setPhase('select')}>
                    Change files
                  </Button>
                  <Button type="button" $variant="danger" onClick={resetAll}>
                    Cancel import
                  </Button>
                  {counts.errors > 0 && (
                    <LinkLike type="button" onClick={downloadErrors}>
                      Download error CSV
                    </LinkLike>
                  )}
                </Actions>
              </Stack>
            </Panel>
          ) : (
            <Panel aria-labelledby="progress-heading">
              <PanelHeader>
                <PanelTitle id="progress-heading">{phase === 'importing' ? '4. Importing' : '5. Results'}</PanelTitle>
                {phase === 'importing' && (
                  <Button
                    type="button"
                    $small
                    $variant="secondary"
                    onClick={() => {
                      stopRef.current = true;
                      setStopReason('Stopped by you. Rows already uploading were allowed to finish.');
                    }}
                  >
                    Stop after current rows
                  </Button>
                )}
              </PanelHeader>
              <Stack $gap={16}>
                {phase === 'importing' && (
                  <Bar role="progressbar" aria-valuemin={0} aria-valuemax={progress.rows} aria-valuenow={progress.done} aria-label="Import progress">
                    <span>
                      {progress.done} of {progress.rows} reports · {formatFileSize(progress.sent)} of {formatFileSize(progress.total)} uploaded
                    </span>
                    <div className="track">
                      <div className="fill" style={{ width: `${progress.rows ? Math.max(2, (progress.done / progress.rows) * 100) : 0}%` }} />
                    </div>
                  </Bar>
                )}
                {stopReason && <Alert tone={phase === 'done' ? 'info' : 'error'}>{stopReason}</Alert>}
                <StatFive>
                  <Stat value={counts.total} label="Rows in the CSV" />
                  <Stat value={counts.imported} label="Imported" />
                  <Stat value={counts.failed} label="Failed" highlight={counts.failed > 0} />
                  <Stat value={counts.skipped} label="Skipped" />
                  <Stat value={counts.duplicates} label="Duplicate warnings" />
                </StatFive>
                {phase === 'done' && (
                  <Actions>
                    {entries.some((e) => e.run === 'failed' && importable(e)) && (
                      <Button type="button" onClick={retryFailed}>
                        Retry failed rows
                      </Button>
                    )}
                    {(counts.failed > 0 || counts.skipped > 0) && (
                      <Button type="button" $variant="secondary" onClick={downloadErrors}>
                        Download error CSV
                      </Button>
                    )}
                    <LinkButton href="/admin/reports" $variant="secondary">
                      View reports
                    </LinkButton>
                    <Button type="button" $variant="secondary" onClick={resetAll}>
                      New import
                    </Button>
                  </Actions>
                )}
              </Stack>
            </Panel>
          )}

          <Panel aria-label="Rows">
            <PanelHeader>
              <PanelTitle>Rows</PanelTitle>
              <label style={{ display: 'inline-flex', gap: 8, alignItems: 'center', fontSize: 14 }}>
                <input type="checkbox" checked={onlyProblems} onChange={(e) => setOnlyProblems(e.target.checked)} />
                Show only rows that need attention
              </label>
            </PanelHeader>
            <ResponsiveTable>
              <thead>
                <tr>
                  <th scope="col">Row</th>
                  <th scope="col">Report</th>
                  <th scope="col">Category</th>
                  <th scope="col">Report date</th>
                  <th scope="col">PDF</th>
                  <th scope="col">Status</th>
                  <th scope="col">Import</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((e) => (
                  <tr key={e.raw.rowNumber}>
                    <td data-label="Row">{e.raw.rowNumber}</td>
                    <td data-label="Report">
                      <Strong>{e.raw.title || '—'}</Strong>
                    </td>
                    <td data-label="Category">{e.row ? CATEGORY_LABELS[e.row.category] : e.raw.category || '—'}</td>
                    <td data-label="Report date">{e.row ? formatCalendarDate(e.row.reportDate) : e.raw.reportDate || '—'}</td>
                    <td data-label="PDF">
                      <span>{e.raw.fileName || '—'}</span>
                      {e.file && <Sub>{formatFileSize(e.file.size)}</Sub>}
                    </td>
                    <td data-label="Status">{e.row ? (e.row.status === 'PUBLISHED' ? 'Published' : 'Draft') : e.raw.status || '—'}</td>
                    <td data-label="Import">
                      <RowStatus entry={e} phase={phase} onInclude={(include) => patch(e.raw.rowNumber, { include })} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </ResponsiveTable>
            {!showAll && (onlyProblems ? entries.filter((e) => e.problems.length || e.duplicates.length).length : entries.length) > visible.length && (
              <Actions style={{ marginTop: 14 }}>
                <Button type="button" $small $variant="secondary" onClick={() => setShowAll(true)}>
                  Show all rows
                </Button>
              </Actions>
            )}
          </Panel>
        </>
      )}
    </Stack>
  );
}

function RowStatus({ entry: e, phase, onInclude }: { entry: Entry; phase: Phase; onInclude: (v: boolean) => void }) {
  const reportLink = (r: { id: string; title?: string }) => <Link href={`/admin/reports/${r.id}/edit`}>{r.title ? `“${r.title}”` : 'Open'}</Link>;

  if (phase === 'review') {
    if (e.problems.length) {
      return (
        <>
          <Badge tone="danger">Error</Badge>
          {e.problems.map((p) => (
            <RowNote key={p} $tone="danger">
              {p}
            </RowNote>
          ))}
        </>
      );
    }
    if (e.alreadyImported) {
      return (
        <>
          <Badge tone="info">Imported earlier</Badge>
          <RowNote>Already a report: {reportLink(e.alreadyImported)}. It will not be imported again.</RowNote>
        </>
      );
    }
    return (
      <>
        {e.duplicates.length ? <Badge tone="warning">Possible duplicate</Badge> : <Badge tone="success">Ready</Badge>}
        {e.duplicates.map((d) => (
          <RowNote key={d.id}>
            Matches {reportLink(d)} ({d.status.toLowerCase()}, {formatCalendarDate(d.reportDate)}).
          </RowNote>
        ))}
        {e.duplicates.length > 0 && (
          <RowNote>
            <label>
              <input type="checkbox" checked={e.include} onChange={(ev) => onInclude(ev.target.checked)} /> Import anyway, as a separate report
            </label>
          </RowNote>
        )}
        {e.notes.map((n) => (
          <RowNote key={n}>{n}</RowNote>
        ))}
      </>
    );
  }

  switch (e.run) {
    case 'queued':
      return <Badge tone="neutral">Queued</Badge>;
    case 'uploading':
      return <Badge tone="info">Uploading {Math.round(e.progress * 100)}%</Badge>;
    case 'saving':
      return <Badge tone="info">Verifying &amp; saving</Badge>;
    case 'imported':
      return (
        <>
          <Badge tone="success">Imported</Badge>
          {e.report && <RowNote>{reportLink({ id: e.report.id })}</RowNote>}
        </>
      );
    case 'already':
      return (
        <>
          <Badge tone="info">Imported earlier</Badge>
          {e.report && <RowNote>{reportLink({ id: e.report.id })}</RowNote>}
        </>
      );
    case 'failed':
      return (
        <>
          <Badge tone="danger">Failed</Badge>
          {e.message && <RowNote $tone="danger">{e.message}</RowNote>}
        </>
      );
    case 'skipped':
      return (
        <>
          <Badge tone="warning">Skipped</Badge>
          {e.message && <RowNote>{e.message}</RowNote>}
        </>
      );
    default:
      return <Badge tone="neutral">—</Badge>;
  }
}

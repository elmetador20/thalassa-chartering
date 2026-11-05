'use client';

import React, { useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import { createReportAction } from '@/app/admin/actions/reports';
import type { CreatedReportData } from '@/lib/reports/action-types';
import { UploadFailure, uploadPdf, type UploadedPdf } from '@/lib/reports/upload-client';
import type { FieldErrors } from '@/lib/validation/auth';
import { LinkButton } from './LinkButton';
import PdfDropzone from './PdfDropzone';
import ReportDetailsFields, { validateDetails, type ReportDetailsValues } from './ReportDetailsFields';
import { Alert, Button, Panel, PanelHeader, PanelTitle, Stack } from './ui';

// ============================================================================
// New report: choose PDF → fill details → Save as draft / Publish now.
//
//   1. the PDF goes straight to storage (signed URL, progress bar)
//   2. the details + upload key go to the server action, which verifies the
//      file and saves the report
//
// Double submits are harmless: buttons lock while working, and the server
// treats a repeated upload key as the same report. If saving fails after the
// upload, a retry reuses the uploaded file instead of sending it again.
// ============================================================================

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding-top: 4px;
`;

const Done = styled.div`
  display: grid;
  gap: 16px;

  ul {
    display: grid;
    gap: 4px;
    padding-left: 18px;
    list-style: disc;
  }
`;

type Phase = 'idle' | 'uploading' | 'saving';
type Intent = 'draft' | 'publish';

/** "monthly-coal_outlook.pdf" → "monthly coal outlook" */
function titleFromFileName(name: string): string {
  return name
    .replace(/\.pdf$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

interface Props {
  today: string;
  canPublish: boolean;
  storageReady: boolean;
}

export default function ReportUploadForm({ today, canPublish, storageReady }: Props) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<(UploadedPdf & { file: File }) | null>(null);
  const [values, setValues] = useState<ReportDetailsValues>({ title: '', category: '', reportDate: today, description: '' });
  const [titleTouched, setTitleTouched] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [progress, setProgress] = useState<number | null>(null);
  const [failure, setFailure] = useState<string | null>(null);
  const [created, setCreated] = useState<{ data: CreatedReportData; message: string; warnings: string[] } | null>(null);
  const lock = useRef(false);
  const abort = useRef<AbortController | null>(null);
  const topRef = useRef<HTMLElement>(null);

  const busy = phase !== 'idle';

  // Warn before leaving mid-upload.
  useEffect(() => {
    if (!busy) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [busy]);

  useEffect(() => () => abort.current?.abort(), []);

  function chooseFile(next: File | null) {
    setFile(next);
    setFailure(null);
    if (next && !titleTouched) setValues((v) => ({ ...v, title: titleFromFileName(next.name) }));
  }

  async function submit(intent: Intent) {
    if (lock.current) return;
    setFailure(null);

    const detailErrors = validateDetails(values) ?? {};
    const missingFile = !file ? 'Choose the PDF to upload.' : null;
    setErrors(detailErrors);
    if (missingFile) setFileError(missingFile);
    if (Object.keys(detailErrors).length > 0 || missingFile || !file) {
      setFailure('Check the highlighted fields.');
      return;
    }

    lock.current = true;
    try {
      let pdf = uploaded && uploaded.file === file ? uploaded : null;
      if (!pdf) {
        setPhase('uploading');
        setProgress(0);
        abort.current = new AbortController();
        const result = await uploadPdf(file, { onProgress: setProgress, signal: abort.current.signal });
        pdf = { ...result, file };
        setUploaded(pdf);
      }

      setPhase('saving');
      const outcome = await createReportAction({ ...values, intent, uploadKey: pdf.uploadKey, fileName: pdf.fileName });
      if (outcome.ok) {
        setCreated({ data: outcome.data, message: outcome.message, warnings: outcome.warnings });
        topRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' });
        return;
      }
      if (outcome.code === 'upload_missing' || outcome.code === 'upload_invalid') {
        setUploaded(null); // the next attempt must send the file again
        if (outcome.code === 'upload_invalid') setFileError(outcome.message);
      }
      setErrors(outcome.fieldErrors ?? {});
      setFailure(outcome.message);
    } catch (error) {
      setFailure(error instanceof UploadFailure ? error.message : 'Something went wrong. Please try again.');
      if (error instanceof UploadFailure && error.fieldErrors) setFileError(Object.values(error.fieldErrors).flat()[0] ?? null);
    } finally {
      lock.current = false;
      abort.current = null;
      setPhase('idle');
      setProgress(null);
    }
  }

  function startAnother() {
    // Category and date are usually the same for a batch of uploads.
    setValues((v) => ({ title: '', category: v.category, reportDate: v.reportDate, description: '' }));
    setTitleTouched(false);
    setFile(null);
    setUploaded(null);
    setErrors({});
    setFailure(null);
    setFileError(null);
    setCreated(null);
  }

  if (created) {
    const { data } = created;
    const published = data.status === 'PUBLISHED';
    return (
      <Panel ref={topRef as React.RefObject<HTMLElement>}>
        <Done>
          <Alert tone="success">
            {created.message} {published ? 'It is now visible on the website.' : 'It is not visible on the website until it is published.'}
          </Alert>
          {created.warnings.length > 0 && (
            <Alert tone="info">
              <ul>
                {created.warnings.map((w) => (
                  <li key={w}>{w}</li>
                ))}
              </ul>
            </Alert>
          )}
          <Actions>
            <Button type="button" onClick={startAnother}>
              Upload another report
            </Button>
            <LinkButton href={`/admin/reports/${data.id}/edit`} $variant="secondary">
              Open this report
            </LinkButton>
            {published && (
              <LinkButton href={`/reports/${data.slug}`} $variant="secondary" target="_blank" rel="noopener noreferrer">
                View on website
              </LinkButton>
            )}
            <LinkButton href="/admin/reports" $variant="secondary">
              All reports
            </LinkButton>
          </Actions>
        </Done>
      </Panel>
    );
  }

  return (
    <div ref={topRef as React.RefObject<HTMLDivElement>}>
      <form
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          void submit('draft');
        }}
        aria-busy={busy}
      >
        <Stack $gap={20}>
          {!storageReady && (
            <Alert tone="info">
              PDF storage is not connected yet, so files cannot be uploaded. This page will work as soon as storage is configured.
            </Alert>
          )}
          {failure && <Alert tone="error">{failure}</Alert>}

          <Panel>
            <PanelHeader>
              <PanelTitle>PDF</PanelTitle>
            </PanelHeader>
            <PdfDropzone
              file={file}
              onFile={chooseFile}
              progress={phase === 'uploading' || phase === 'saving' ? (progress ?? 1) : null}
              error={fileError}
              onError={setFileError}
              disabled={!storageReady || busy}
              label="Report PDF"
            />
          </Panel>

          <Panel>
            <PanelHeader>
              <PanelTitle>Details</PanelTitle>
            </PanelHeader>
            <Stack $gap={18}>
              <ReportDetailsFields
                values={values}
                onChange={(next) => {
                  if (next.title !== values.title) setTitleTouched(true);
                  setValues(next);
                }}
                errors={errors}
                today={today}
                disabled={busy}
              />
            </Stack>
          </Panel>

          <Actions>
            {canPublish && (
              <Button type="button" $variant="success" disabled={busy || !storageReady} onClick={() => void submit('publish')}>
                {phase === 'idle' ? 'Publish now' : 'Working…'}
              </Button>
            )}
            <Button type="submit" $variant={canPublish ? 'secondary' : 'primary'} disabled={busy || !storageReady}>
              {phase === 'idle' ? 'Save as draft' : phase === 'uploading' ? 'Uploading…' : 'Saving…'}
            </Button>
            {phase === 'uploading' && (
              <Button type="button" $variant="secondary" onClick={() => abort.current?.abort()}>
                Cancel upload
              </Button>
            )}
            <LinkButton href="/admin/reports" $variant="secondary" aria-disabled={busy} tabIndex={busy ? -1 : undefined}>
              Cancel
            </LinkButton>
          </Actions>
        </Stack>
      </form>
    </div>
  );
}

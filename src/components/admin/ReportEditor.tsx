'use client';

import React, { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import styled from 'styled-components';
import {
  archiveReportAction,
  deleteReportAction,
  publishReportAction,
  replaceReportFileAction,
  restoreReportAction,
  updateReportAction,
} from '@/app/admin/actions/reports';
import { formatDateTime } from '@/lib/admin-format';
import type { ReportActionResult } from '@/lib/reports/action-types';
import { formatFileSize } from '@/lib/reports/constants';
import { UploadFailure, uploadPdf, type UploadedPdf } from '@/lib/reports/upload-client';
import type { FieldErrors } from '@/lib/validation/auth';
import PdfDropzone from './PdfDropzone';
import ReportDetailsFields, { validateDetails, type ReportDetailsValues } from './ReportDetailsFields';
import { Alert, Button, Field, Input, Muted, Panel, PanelHeader, PanelTitle, Stack, StatusBadge } from './ui';

// The pieces of the report edit page. Each panel calls one server action;
// the server re-checks permissions, so hiding a control is only a courtesy.

export interface EditableReport {
  id: string;
  title: string;
  slug: string;
  category: string;
  status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  reportDate: string;
  description: string | null;
  fileName: string;
  fileSize: number;
  publishedAt: string | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { name: string };
}

const Actions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
`;

const Facts = styled.dl`
  display: grid;
  grid-template-columns: auto minmax(0, 1fr);
  gap: 8px 16px;
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

const Danger = styled(Panel)`
  border-color: ${({ theme }) => theme.colors.danger};
`;

const Warnings = ({ items }: { items: string[] }) =>
  items.length ? (
    <Alert tone="info">
      {items.map((w) => (
        <div key={w}>{w}</div>
      ))}
    </Alert>
  ) : null;

// ----------------------------------------------------------------- details --

export function ReportDetailsForm({ report, today, canUpdate }: { report: EditableReport; today: string; canUpdate: boolean }) {
  const [values, setValues] = useState<ReportDetailsValues>({
    title: report.title,
    category: report.category,
    reportDate: report.reportDate,
    description: report.description ?? '',
  });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [result, setResult] = useState<ReportActionResult<{ changed: string[] }> | null>(null);
  const [pending, startTransition] = useTransition();

  function save(e: React.FormEvent) {
    e.preventDefault();
    if (pending) return;
    const problems = validateDetails(values);
    setErrors(problems ?? {});
    if (problems) {
      setResult({ ok: false, code: 'validation', message: 'Check the highlighted fields.' });
      return;
    }
    setResult(null);
    startTransition(async () => {
      const outcome = await updateReportAction(report.id, values);
      setResult(outcome);
      if (!outcome.ok) setErrors(outcome.fieldErrors ?? {});
    });
  }

  return (
    <Panel aria-labelledby="details-heading">
      <PanelHeader>
        <PanelTitle id="details-heading">Details</PanelTitle>
      </PanelHeader>
      <form onSubmit={save} noValidate>
        <Stack $gap={18}>
          {result && <Alert tone={result.ok ? 'success' : 'error'}>{result.message}</Alert>}
          <ReportDetailsFields values={values} onChange={setValues} errors={errors} today={today} disabled={!canUpdate || pending} />
          {canUpdate && (
            <Actions>
              <Button type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Save changes'}
              </Button>
            </Actions>
          )}
          <Muted>Saving details never changes whether the report is published.</Muted>
        </Stack>
      </form>
    </Panel>
  );
}

// ------------------------------------------------------------- replace PDF --

export function ReplacePdfPanel({ report, storageReady, canReplace }: { report: EditableReport; storageReady: boolean; canReplace: boolean }) {
  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState<(UploadedPdf & { file: File }) | null>(null);
  const [progress, setProgress] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ReportActionResult<null> | { ok: false; message: string } | null>(null);
  const lock = useRef(false);

  async function replace() {
    if (lock.current || !file) return;
    lock.current = true;
    setBusy(true);
    setResult(null);
    try {
      let pdf = uploaded && uploaded.file === file ? uploaded : null;
      if (!pdf) {
        setProgress(0);
        pdf = { ...(await uploadPdf(file, { onProgress: setProgress })), file };
        setUploaded(pdf);
      }
      const outcome = await replaceReportFileAction(report.id, { uploadKey: pdf.uploadKey, fileName: pdf.fileName });
      setResult(outcome);
      if (outcome.ok) {
        setFile(null);
        setUploaded(null);
      } else if (outcome.code === 'upload_missing' || outcome.code === 'upload_invalid') {
        setUploaded(null);
        if (outcome.code === 'upload_invalid') setFileError(outcome.message);
      }
    } catch (error) {
      setResult({ ok: false, message: error instanceof UploadFailure ? error.message : 'Something went wrong. Please try again.' });
    } finally {
      lock.current = false;
      setBusy(false);
      setProgress(null);
    }
  }

  return (
    <Panel aria-labelledby="file-heading">
      <PanelHeader>
        <PanelTitle id="file-heading">PDF file</PanelTitle>
      </PanelHeader>
      <Stack $gap={16}>
        <Facts>
          <dt>Current file</dt>
          <dd>{report.fileName}</dd>
          <dt>Size</dt>
          <dd>{formatFileSize(report.fileSize)}</dd>
        </Facts>
        {result && <Alert tone={result.ok ? 'success' : 'error'}>{result.message}</Alert>}
        {result?.ok && 'warnings' in result && <Warnings items={result.warnings} />}
        {canReplace &&
          (storageReady ? (
            <>
              <PdfDropzone
                file={file}
                onFile={(f) => {
                  setFile(f);
                  setResult(null);
                }}
                progress={busy ? (progress ?? 1) : null}
                error={fileError}
                onError={setFileError}
                disabled={busy}
                label="Replacement PDF"
              />
              {file && (
                <Actions>
                  <Button type="button" onClick={() => void replace()} disabled={busy}>
                    {busy ? 'Replacing…' : 'Replace PDF'}
                  </Button>
                </Actions>
              )}
              <Muted>The title, link and status stay the same. The old file is removed once the new one is in place.</Muted>
            </>
          ) : (
            <Muted>Replacing the PDF will be possible once file storage is connected.</Muted>
          ))}
      </Stack>
    </Panel>
  );
}

// ------------------------------------------------------------------ status --

const STATUS_HELP: Record<EditableReport['status'], string> = {
  DRAFT: 'Only administrators can see this report.',
  PUBLISHED: 'Visible to everyone on the website.',
  ARCHIVED: 'Hidden from the website. Restore it to a draft to publish it again.',
};

export function StatusPanel({ report, canPublish, canArchive }: { report: EditableReport; canPublish: boolean; canArchive: boolean }) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReportActionResult<null> | null>(null);

  const run = (action: () => Promise<ReportActionResult<null>>) => {
    setResult(null);
    startTransition(async () => setResult(await action()));
  };

  return (
    <Panel aria-labelledby="status-heading">
      <PanelHeader>
        <PanelTitle id="status-heading">Status</PanelTitle>
        <StatusBadge status={report.status} />
      </PanelHeader>
      <Stack $gap={16}>
        <Muted>{STATUS_HELP[report.status]}</Muted>
        {result && <Alert tone={result.ok ? 'success' : 'error'}>{result.message}</Alert>}
        <Facts>
          <dt>Added</dt>
          <dd>
            {formatDateTime(report.createdAt)} by {report.createdBy.name}
          </dd>
          <dt>First published</dt>
          <dd>{report.publishedAt ? formatDateTime(report.publishedAt) : 'Not yet'}</dd>
          {report.archivedAt && (
            <>
              <dt>Archived</dt>
              <dd>{formatDateTime(report.archivedAt)}</dd>
            </>
          )}
          <dt>Last updated</dt>
          <dd>{formatDateTime(report.updatedAt)}</dd>
        </Facts>
        <Actions>
          {canPublish && report.status === 'DRAFT' && (
            <Button type="button" $variant="success" disabled={pending} onClick={() => run(() => publishReportAction(report.id))}>
              {pending ? 'Publishing…' : 'Publish'}
            </Button>
          )}
          {canArchive && report.status !== 'ARCHIVED' && (
            <Button
              type="button"
              $variant="secondary"
              disabled={pending}
              onClick={() => {
                const note = report.status === 'PUBLISHED' ? ' It will be removed from the website immediately.' : '';
                if (window.confirm(`Archive this report?${note}`)) run(() => archiveReportAction(report.id));
              }}
            >
              {pending ? 'Archiving…' : 'Archive'}
            </Button>
          )}
          {canArchive && report.status === 'ARCHIVED' && (
            <Button type="button" $variant="secondary" disabled={pending} onClick={() => run(() => restoreReportAction(report.id))}>
              {pending ? 'Restoring…' : 'Restore to draft'}
            </Button>
          )}
        </Actions>
      </Stack>
    </Panel>
  );
}

// ------------------------------------------------------------------ delete --

export function DeletePanel({ report, storageReady }: { report: EditableReport; storageReady: boolean }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState('');
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<ReportActionResult<null> | null>(null);
  const matches = typed.trim() === report.title;

  function remove(e: React.FormEvent) {
    e.preventDefault();
    if (!matches || pending) return;
    startTransition(async () => {
      const outcome = await deleteReportAction(report.id, typed);
      if (outcome.ok) {
        router.replace(`/admin/reports?notice=${outcome.warnings.length ? 'deleted-file-kept' : 'deleted'}`);
        return;
      }
      setResult(outcome);
    });
  }

  return (
    <Danger aria-labelledby="delete-heading" id="delete">
      <PanelHeader>
        <PanelTitle id="delete-heading">Delete permanently</PanelTitle>
      </PanelHeader>
      <Stack $gap={14}>
        <Muted>
          Removes the report and its PDF for good. This cannot be undone. To hide a report from the website instead, archive it.
        </Muted>
        {!storageReady ? (
          <Muted>Deleting is available once file storage is connected, so that no file is left behind.</Muted>
        ) : !open ? (
          <Actions>
            <Button type="button" $variant="danger" onClick={() => setOpen(true)}>
              Delete this report…
            </Button>
          </Actions>
        ) : (
          <form onSubmit={remove}>
            <Stack $gap={14}>
              {result && !result.ok && <Alert tone="error">{result.message}</Alert>}
              <Field label="Type the report title to confirm" hint={<>Exactly: “{report.title}”</>} errors={result && !result.ok ? result.fieldErrors?.confirmation : undefined}>
                {(p) => (
                  <Input {...p} value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} disabled={pending} />
                )}
              </Field>
              <Actions>
                <Button type="submit" $variant="danger" disabled={!matches || pending}>
                  {pending ? 'Deleting…' : 'Delete permanently'}
                </Button>
                <Button
                  type="button"
                  $variant="secondary"
                  disabled={pending}
                  onClick={() => {
                    setOpen(false);
                    setTyped('');
                    setResult(null);
                  }}
                >
                  Cancel
                </Button>
              </Actions>
            </Stack>
          </form>
        )}
      </Stack>
    </Danger>
  );
}

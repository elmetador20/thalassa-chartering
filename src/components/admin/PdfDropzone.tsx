'use client';

import React, { useId, useRef, useState } from 'react';
import styled from 'styled-components';
import { formatFileSize } from '@/lib/reports/constants';
import { precheckPdf } from '@/lib/reports/upload-client';

// Drag-and-drop or click to choose one PDF. The real <input type="file"> stays
// in the page (visually hidden), so keyboard and screen-reader users get the
// native file picker.

const Zone = styled.label<{ $drag: boolean; $invalid: boolean; $disabled: boolean }>`
  position: relative;
  display: grid;
  place-items: center;
  gap: 6px;
  min-height: 150px;
  padding: 24px 18px;
  text-align: center;
  border: 1.5px dashed ${({ $invalid, $drag, theme }) => ($invalid ? theme.colors.danger : $drag ? theme.colors.navy : '#7A8C9E')};
  border-radius: ${({ theme }) => theme.layout.radius};
  background: ${({ $drag, theme }) => ($drag ? theme.colors.infoSoft : theme.colors.offWhite)};
  cursor: ${({ $disabled }) => ($disabled ? 'not-allowed' : 'pointer')};
  opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
  transition: background 0.15s ease, border-color 0.15s ease;

  &:focus-within {
    outline: 2px solid ${({ theme }) => theme.colors.orange};
    outline-offset: 2px;
  }
  strong {
    font-size: 15.5px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textOnLight};
  }
  span {
    font-size: 13.5px;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
  input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
  }
`;

const Chosen = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 10px 16px;
  padding: 14px 16px;
  border: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  border-radius: ${({ theme }) => theme.layout.radius};
  background: #fff;

  .name {
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textOnLight};
    overflow-wrap: anywhere;
  }
  .meta {
    font-size: 13.5px;
    color: ${({ theme }) => theme.colors.mutedOnLight};
  }
  button {
    min-height: 36px;
    padding: 0 12px;
    border: 1px solid #7a8c9e;
    background: #fff;
    font-size: 13.5px;
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textOnLight};
    cursor: pointer;
  }
  button:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }
`;

const Progress = styled.div`
  grid-column: 1 / -1;
  width: 100%;
  display: grid;
  gap: 6px;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.mutedOnLight};

  .track {
    height: 6px;
    background: ${({ theme }) => theme.colors.neutralSoft};
    overflow: hidden;
  }
  .bar {
    height: 100%;
    background: ${({ theme }) => theme.colors.navy};
    transition: width 0.2s ease;
  }
`;

const ErrorText = styled.p`
  margin-top: 8px;
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.danger};
`;

interface Props {
  file: File | null;
  onFile: (file: File | null) => void;
  /** 0–1 while uploading, otherwise null. */
  progress: number | null;
  error?: string | null;
  onError: (message: string | null) => void;
  disabled?: boolean;
  label?: string;
}

export default function PdfDropzone({ file, onFile, progress, error, onError, disabled = false, label = 'PDF file' }: Props) {
  const id = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [drag, setDrag] = useState(false);
  const busy = progress !== null;

  async function accept(files: FileList | null) {
    if (!files || files.length === 0) return;
    if (files.length > 1) return onError('Choose one PDF at a time.');
    const candidate = files[0];
    const problem = await precheckPdf(candidate);
    if (problem) {
      onError(problem);
      return;
    }
    onError(null);
    onFile(candidate);
  }

  if (file) {
    return (
      <div>
        <Chosen>
          <div>
            <div className="name">{file.name}</div>
            <div className="meta">{formatFileSize(file.size)} · PDF</div>
          </div>
          <button
            type="button"
            disabled={busy || disabled}
            onClick={() => {
              onFile(null);
              onError(null);
            }}
          >
            Choose another file
          </button>
          {busy && (
            <Progress role="progressbar" aria-label="Upload progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
              <span>{progress < 1 ? `Uploading… ${Math.round(progress * 100)}%` : 'Uploaded — checking and saving…'}</span>
              <div className="track">
                <div className="bar" style={{ width: `${Math.max(2, progress * 100)}%` }} />
              </div>
            </Progress>
          )}
        </Chosen>
        {error && <ErrorText role="alert">{error}</ErrorText>}
      </div>
    );
  }

  return (
    <div>
      <Zone
        htmlFor={id}
        $drag={drag}
        $invalid={Boolean(error)}
        $disabled={disabled}
        onDragOver={(e) => {
          if (disabled) return;
          e.preventDefault();
          setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled) void accept(e.dataTransfer.files);
        }}
      >
        <strong>Drop the PDF here, or click to choose</strong>
        <span>{label} · PDF only · up to 50 MB</span>
        <input
          ref={inputRef}
          id={id}
          type="file"
          accept="application/pdf,.pdf"
          disabled={disabled}
          aria-invalid={Boolean(error)}
          onChange={(e) => {
            void accept(e.target.files);
            e.target.value = ''; // allow choosing the same file again
          }}
        />
      </Zone>
      {error && <ErrorText role="alert">{error}</ErrorText>}
    </div>
  );
}

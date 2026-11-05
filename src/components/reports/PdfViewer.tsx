'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import styled from 'styled-components';
import type { PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs';

// ============================================================================
// Embedded PDF preview (PDF.js), shared by the public report page and the
// admin edit page.
//
// - Nothing is downloaded until the viewer scrolls near the screen: PDF.js
//   (~1 MB) and the file are both fetched lazily.
// - `source` is one of our JSON endpoints; it answers with a short-lived
//   signed link, so the bucket stays private and a stale page simply asks
//   for a fresh link ("Try again").
// - Pages render to <canvas> only — no annotation or form layer, so links and
//   embedded JavaScript inside a PDF are never active. PDF.js's scripting
//   sandbox is not loaded at all.
// - Each page is drawn when it comes into view, so a 300-page report costs
//   no more to open than a 3-page one.
// ============================================================================

type PdfJs = typeof import('pdfjs-dist/legacy/build/pdf.mjs');

let pdfjsPromise: Promise<PdfJs> | null = null;

function loadPdfJs(): Promise<PdfJs> {
  if (!pdfjsPromise) {
    pdfjsPromise = import('pdfjs-dist/legacy/build/pdf.mjs').then((pdfjs) => {
      if (!pdfjs.GlobalWorkerOptions.workerPort) {
        // Bundled with the app (same origin) — no CDN, matches the CSP.
        pdfjs.GlobalWorkerOptions.workerPort = new Worker(new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url), {
          type: 'module',
        });
      }
      return pdfjs;
    });
    pdfjsPromise.catch(() => {
      pdfjsPromise = null;
    });
  }
  return pdfjsPromise;
}

type State =
  | { phase: 'idle' }
  | { phase: 'loading' }
  | { phase: 'ready'; doc: PDFDocumentProxy; pages: number; ratio: number }
  | { phase: 'unavailable'; message: string }
  | { phase: 'error'; message: string };

const Frame = styled.div`
  border: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  background: ${({ theme }) => theme.colors.neutralSoft};
  border-radius: ${({ theme }) => theme.layout.radius};
  overflow: hidden;
`;

const Toolbar = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 8px 16px;
  padding: 10px 14px;
  background: #fff;
  border-bottom: 1px solid ${({ theme }) => theme.colors.lineOnLight};
  font-size: 13.5px;
  color: ${({ theme }) => theme.colors.mutedOnLight};

  a {
    font-weight: 500;
    color: ${({ theme }) => theme.colors.navy};
    text-decoration: underline;
    text-underline-offset: 3px;
  }
`;

const Scroller = styled.div<{ $height: string; $compact: boolean }>`
  height: ${({ $height, $compact }) => ($compact ? 'auto' : $height)};
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: clamp(10px, 2vw, 20px);
  display: grid;
  gap: 14px;
  align-content: start;
`;

const PageBox = styled.div`
  position: relative;
  width: 100%;
  max-width: 920px;
  margin: 0 auto;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 34, 64, 0.12);

  canvas {
    display: block;
    width: 100%;
    height: 100%;
  }
`;

const Message = styled.div`
  display: grid;
  place-items: center;
  gap: 12px;
  min-height: 220px;
  height: 100%;
  padding: 24px;
  text-align: center;
  font-size: 14.5px;
  line-height: 1.55;
  color: ${({ theme }) => theme.colors.bodyOnLight};

  button {
    min-height: 40px;
    padding: 0 16px;
    border: 1px solid ${({ theme }) => theme.colors.navy};
    color: ${({ theme }) => theme.colors.navy};
    background: #fff;
    font-weight: 500;
    cursor: pointer;
  }
`;

const Spinner = styled.span`
  width: 26px;
  height: 26px;
  border: 2px solid ${({ theme }) => theme.colors.lineOnLight};
  border-top-color: ${({ theme }) => theme.colors.navy};
  border-radius: 50%;
  animation: spin 0.8s linear infinite;
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    animation-duration: 2.4s;
  }
`;

/** One page: draws itself when it nears the visible area of the scroller. */
function PdfPage({ doc, number, ratio, root }: { doc: PDFDocumentProxy; number: number; ratio: number; root: HTMLElement | null }) {
  const boxRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(number === 1);
  const [pageRatio, setPageRatio] = useState(ratio);

  useEffect(() => {
    if (visible || !boxRef.current) return;
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setVisible(true), {
      root,
      rootMargin: '600px 0px',
    });
    observer.observe(boxRef.current);
    return () => observer.disconnect();
  }, [visible, root]);

  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    let task: { cancel: () => void; promise: Promise<void> } | null = null;
    (async () => {
      const page = await doc.getPage(number);
      if (cancelled || !canvasRef.current || !boxRef.current) return;
      const base = page.getViewport({ scale: 1 });
      setPageRatio(base.height / base.width);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
      const scale = (boxRef.current.clientWidth * pixelRatio) / base.width;
      const viewport = page.getViewport({ scale });
      const canvas = canvasRef.current;
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      task = page.render({ canvas, viewport });
      await task.promise;
    })().catch(() => {
      /* a cancelled render rejects; a failed page stays blank */
    });
    return () => {
      cancelled = true;
      task?.cancel();
    };
  }, [visible, doc, number]);

  return (
    <PageBox ref={boxRef} style={{ aspectRatio: `1 / ${pageRatio}` }} aria-label={`Page ${number}`} role="img">
      <canvas ref={canvasRef} />
    </PageBox>
  );
}

interface Props {
  /** JSON endpoint returning { url } — e.g. /api/reports/<slug>/file?disposition=inline&format=json */
  source: string;
  /** Link that opens the PDF in the browser's own viewer (new tab). */
  openHref?: string;
  /** Height of the scrolling area. */
  height?: string;
  title: string;
  /** Shown when storage is not connected (HTTP 503). */
  unavailableMessage?: string;
}

export default function PdfViewer({
  source,
  openHref,
  height = 'min(78vh, 900px)',
  title,
  unavailableMessage = 'The PDF is temporarily unavailable. Please try again later.',
}: Props) {
  const frameRef = useRef<HTMLDivElement>(null);
  const [scroller, setScroller] = useState<HTMLDivElement | null>(null);
  const [state, setState] = useState<State>({ phase: 'idle' });
  const [attempt, setAttempt] = useState(0);
  const [near, setNear] = useState(false);

  // Only start once the viewer is close to the screen.
  useEffect(() => {
    if (near || !frameRef.current) return;
    if (typeof IntersectionObserver === 'undefined') return setNear(true);
    const observer = new IntersectionObserver((entries) => entries.some((e) => e.isIntersecting) && setNear(true), { rootMargin: '400px 0px' });
    observer.observe(frameRef.current);
    return () => observer.disconnect();
  }, [near]);

  const load = useCallback(async (signal: { cancelled: boolean }) => {
    setState({ phase: 'loading' });
    try {
      const response = await fetch(source, { cache: 'no-store', credentials: 'same-origin' });
      const body = (await response.json().catch(() => null)) as { url?: string; error?: { code?: string; message?: string } } | null;
      if (signal.cancelled) return;
      if (response.status === 503) {
        return setState({ phase: 'unavailable', message: unavailableMessage });
      }
      if (!response.ok || !body?.url) {
        return setState({ phase: 'error', message: body?.error?.message ?? 'The preview could not be loaded.' });
      }
      const pdfjs = await loadPdfJs();
      const doc = await pdfjs.getDocument({ url: body.url, enableXfa: false, stopAtErrors: false }).promise;
      if (signal.cancelled) return void doc.loadingTask.destroy();
      const first = await doc.getPage(1);
      const viewport = first.getViewport({ scale: 1 });
      if (signal.cancelled) return void doc.loadingTask.destroy();
      setState({ phase: 'ready', doc, pages: doc.numPages, ratio: viewport.height / viewport.width });
    } catch {
      if (!signal.cancelled) setState({ phase: 'error', message: 'The preview could not be loaded.' });
    }
  }, [source, unavailableMessage]);

  useEffect(() => {
    if (!near) return;
    const signal = { cancelled: false };
    void load(signal);
    return () => {
      signal.cancelled = true;
    };
  }, [near, load, attempt]);

  // Free the worker-side document when it is replaced or the viewer unmounts.
  useEffect(() => {
    const doc = state.phase === 'ready' ? state.doc : null;
    return () => {
      void doc?.loadingTask.destroy();
    };
  }, [state]);

  const retry = () => setAttempt((n) => n + 1);

  return (
    <Frame ref={frameRef} aria-label={`Preview of ${title}`} role="region">
      <Toolbar>
        <span aria-live="polite">
          {state.phase === 'ready' ? `${state.pages} page${state.pages === 1 ? '' : 's'}` : state.phase === 'loading' ? 'Loading preview…' : 'PDF preview'}
        </span>
        {openHref && state.phase !== 'unavailable' && (
          <a href={openHref} target="_blank" rel="noopener noreferrer">
            Open full screen
          </a>
        )}
      </Toolbar>
      <Scroller ref={setScroller} $height={height} $compact={state.phase === 'unavailable' || state.phase === 'error'} tabIndex={0}>
        {state.phase === 'ready' ? (
          Array.from({ length: state.pages }, (_, i) => <PdfPage key={i} doc={state.doc} number={i + 1} ratio={state.ratio} root={scroller} />)
        ) : state.phase === 'error' ? (
          <Message>
            <p>{state.message}</p>
            <button type="button" onClick={retry}>
              Try again
            </button>
          </Message>
        ) : state.phase === 'unavailable' ? (
          <Message>
            <p>{state.message}</p>
          </Message>
        ) : (
          <Message>
            <Spinner aria-hidden />
          </Message>
        )}
      </Scroller>
    </Frame>
  );
}

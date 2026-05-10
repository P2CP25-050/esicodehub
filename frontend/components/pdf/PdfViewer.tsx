"use client";

import { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist/legacy/build/pdf.mjs';
import apiClient from '@/lib/axios';

type PdfViewerProps = {
  open: boolean;
  pdfUrl: string | null;
  title?: string;
  onClose: () => void;
};

type PdfDocument = pdfjsLib.PDFDocumentProxy;

type PdfRenderTask = {
  cancel: () => void;
  promise: Promise<unknown>;
};

if (typeof window !== 'undefined') {
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/legacy/build/pdf.worker.min.mjs',
    import.meta.url
  ).toString();
}

export default function PdfViewer({ open, pdfUrl, title, onClose }: PdfViewerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const documentRef = useRef<PdfDocument | null>(null);
  const renderTaskRef = useRef<PdfRenderTask | null>(null);
  const loadingTaskRef = useRef<{ destroy: () => void; promise: Promise<PdfDocument> } | null>(null);

  const [pageNumber, setPageNumber] = useState(1);
  const [numPages, setNumPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !pdfUrl) return;

    let cancelled = false;

    const loadPdf = async () => {
      setLoading(true);
      setError(null);
      setPageNumber(1);
      setNumPages(0);

      try {
        const response = await apiClient.get<ArrayBuffer>(pdfUrl, {
          responseType: 'arraybuffer',
        });

        if (cancelled) return;

        const loadingTask = pdfjsLib.getDocument({
          data: new Uint8Array(response.data),
        });
        loadingTaskRef.current = loadingTask;
        const document = await loadingTask.promise;

        if (cancelled) {
          await document.destroy();
          return;
        }

        documentRef.current = document;
        setNumPages(document.numPages);
        setLoading(false);
      } catch (loadError) {
        if (cancelled) return;
        setError(
          loadError instanceof Error
            ? loadError.message
            : 'Failed to load PDF preview.'
        );
        setLoading(false);
      }
    };

    void loadPdf();

    return () => {
      cancelled = true;
      renderTaskRef.current?.cancel();
      renderTaskRef.current = null;
      loadingTaskRef.current?.destroy();
      loadingTaskRef.current = null;
      void documentRef.current?.destroy();
      documentRef.current = null;
    };
  }, [open, pdfUrl]);

  useEffect(() => {
    if (!open || !documentRef.current || !canvasRef.current) return;

    let cancelled = false;

    const renderPage = async () => {
      try {
        const pdfDocument = documentRef.current;
        const canvas = canvasRef.current;
        const container = containerRef.current;
        if (!pdfDocument || !canvas || !container) return;

        const page = await pdfDocument.getPage(pageNumber);
        if (cancelled) return;

        const baseViewport = page.getViewport({ scale: 1 });
        const availableWidth = Math.max(container.clientWidth - 32, 320);
        const scale = Math.min(1.8, Math.max(0.75, availableWidth / baseViewport.width));
        const viewport = page.getViewport({ scale });

        canvas.width = Math.floor(viewport.width);
        canvas.height = Math.floor(viewport.height);

        const context = canvas.getContext('2d', { alpha: false });
        if (!context) {
          setError('Canvas rendering is not supported in this browser.');
          return;
        }

        renderTaskRef.current?.cancel();
        const renderTask = page.render({ canvasContext: context, canvas, viewport });
        renderTaskRef.current = renderTask as PdfRenderTask;
        await renderTask.promise;
      } catch (renderError) {
        if (cancelled) return;
        if (renderError instanceof Error && renderError.name === 'RenderingCancelledException') {
          return;
        }
        setError(
          renderError instanceof Error
            ? renderError.message
            : 'Failed to render PDF page.'
        );
      }
    };

    void renderPage();

    return () => {
      cancelled = true;
    };
  }, [open, pageNumber, numPages]);

  const canGoPrevious = pageNumber > 1;
  const canGoNext = numPages > 0 && pageNumber < numPages;

  if (!open || !pdfUrl) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
      onClick={onClose}
    >
      <div
        className="flex max-h-[92vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 px-5 py-4 sm:px-6">
          <div>
            <h2 className="text-lg font-bold text-[#0d1b2a]">{title ?? 'PDF Preview'}</h2>
            <p className="text-xs text-slate-500">
              Use the buttons below to navigate pages. Download remains a separate action.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            Close
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3 text-sm sm:px-6">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setPageNumber((current) => Math.max(1, current - 1))}
              disabled={!canGoPrevious}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Previous
            </button>
            <button
              type="button"
              onClick={() => setPageNumber((current) => Math.min(numPages, current + 1))}
              disabled={!canGoNext}
              className="rounded-lg border border-slate-200 bg-white px-3 py-2 font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              Next
            </button>
          </div>
          <div className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
            {numPages > 0 ? `Page ${pageNumber} of ${numPages}` : 'Loading pages...'}
          </div>
        </div>

        <div ref={containerRef} className="flex-1 overflow-auto bg-slate-100 p-4 sm:p-6">
          {loading && (
            <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">
              Loading PDF preview...
            </div>
          )}

          {!loading && error && (
            <div className="flex min-h-[40vh] items-center justify-center rounded-2xl border border-rose-200 bg-rose-50 px-6 py-10 text-sm text-rose-700">
              {error}
            </div>
          )}

          {!loading && !error && (
            <div className="flex justify-center">
              <div className="overflow-auto rounded-2xl bg-white shadow-lg">
                <canvas ref={canvasRef} className="block max-w-none" />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

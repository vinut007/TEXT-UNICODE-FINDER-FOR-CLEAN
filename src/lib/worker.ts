import { formatBytes } from './utils';
import type {
  ExcelData,
  FileType,
  ScanOptions,
  WorkerProgress,
  WorkerResponse,
} from '@/types/analysis';

type ProgressFn = (p: WorkerProgress) => void;
type Result = Exclude<WorkerResponse, { type: 'progress' }>;

/** Files smaller than this are read whole and transferred zero-copy to the worker.
 * Larger text/CSV files stream from the File object so we never hold the entire
 * file in memory at once. */
export const ZERO_COPY_BYTES = 100 * 1024 * 1024;

/** Excel and Access cannot be streamed (SheetJS / mdb-reader need the whole
 * file), so they must be buffered. Cap this to avoid exhausting the browser heap. */
export const MAX_BUFFER_BYTES = 300 * 1024 * 1024;

/**
 * Thin wrapper around the analysis Web Worker. Keeps a single long-lived
 * worker instance so repeated scans do not pay module-loading cost.
 */
class AnalyzeWorker {
  private worker: Worker | null = null;
  private pendingReject: ((e: Error) => void) | null = null;

  private ensure(): Worker {
    if (!this.worker) {
      this.worker = new Worker(
        new URL('../workers/analyze.worker.ts', import.meta.url),
        { type: 'module' },
      );
      this.worker.addEventListener('error', (e) => {
        const raw = (e as ErrorEvent).message || 'The analysis worker crashed.';
        const err = new Error(raw.replace(/^Uncaught\s+/, ''));
        if (this.pendingReject) {
          const r = this.pendingReject;
          this.pendingReject = null;
          r(err);
        }
      });
    }
    return this.worker;
  }

  analyze(
    file: File | null,
    fileType: FileType,
    options: ScanOptions,
    onProgress: ProgressFn,
    preloadedExcel?: ExcelData,
  ): Promise<Result> {
    const w = this.ensure();
    return new Promise<Result>((resolve, reject) => {
      this.pendingReject = reject;
      const handler = (e: MessageEvent<WorkerResponse>) => {
        const msg = e.data;
        if (msg.type === 'progress') {
          onProgress(msg);
          return;
        }
        w.removeEventListener('message', handler);
        this.pendingReject = null;
        resolve(msg as Result);
      };
      w.addEventListener('message', handler);

      void (async () => {
        try {
          if (!file && !preloadedExcel) {
            throw new Error('No file to analyze.');
          }
          if (!file) {
            // Re-analysis with a preloaded cell grid (Access). Nothing to transfer.
            w.postMessage({
              type: 'analyze',
              file: null,
              buffer: null,
              fileName: '',
              fileSize: 0,
              fileType,
              options,
              preloadedExcel,
            });
            return;
          }
          const { name, size, type } = file;

          // Excel / Access need the whole file in memory (SheetJS / mdb-reader
          // cannot stream). Buffer them and cap the size to avoid exhausting
          // the browser heap. Large text / CSV files stream from the File object
          // instead (Blob data is shared, not copied).
          let buffer: ArrayBuffer | null = null;
          if (fileType === 'excel' || fileType === 'access') {
            if (size > MAX_BUFFER_BYTES) {
              throw new Error(
                `File is too large (${formatBytes(size)}). Excel and Access files are limited to ${formatBytes(MAX_BUFFER_BYTES)} because they are read entirely into memory.`,
              );
            }
            buffer = await file.arrayBuffer();
          } else if (size <= ZERO_COPY_BYTES) {
            buffer = await file.arrayBuffer();
          }

          if (buffer) {
            w.postMessage(
              {
                type: 'analyze',
                file: null,
                buffer,
                fileName: name,
                fileSize: size,
                fileType,
                options,
                preloadedExcel: null,
              },
              [buffer],
            );
          } else {
            // Large text / CSV: stream from the File object.
            w.postMessage({
              type: 'analyze',
              file,
              buffer: null,
              fileName: name,
              fileSize: size,
              fileType,
              options,
              preloadedExcel: null,
            });
          }
        } catch (err) {
          w.removeEventListener('message', handler);
          this.pendingReject = null;
          reject(err instanceof Error ? err : new Error('Could not send file to worker.'));
        }
      })();
    });
  }

  cancel(): void {
    try {
      this.worker?.postMessage({ type: 'cancel' });
    } catch {
      /* worker may not exist yet */
    }
  }
}

export const analyzeWorker = new AnalyzeWorker();

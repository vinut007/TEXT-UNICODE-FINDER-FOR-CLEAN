/// <reference lib="webworker" />
import '@/lib/node-shim';
import '@/lib/buffer-polyfill';
import { analyzeFile } from '@/lib/engine/analyze';
import { ANALYSIS_STAGES } from '@/types/analysis';
import type { WorkerRequest, WorkerResponse, WorkerProgress } from '@/types/analysis';

const ctx = self as unknown as DedicatedWorkerGlobalScope;

let cancelled = false;
let lastPost = 0;
let lastStage = -1;
let replied = false;

function post(msg: WorkerResponse) {
  ctx.postMessage(msg);
}

function postError(message: string) {
  if (replied) return;
  replied = true;
  post({ type: 'error', message });
}

// Catch async/uncaught errors (e.g. from cipher-base's Transform scheduling
// work via process.nextTick) that escape the onmessage try/catch.
ctx.addEventListener('error', (e: ErrorEvent) => {
  let msg = e.message || 'Unknown worker error';
  msg = msg.replace(/^Uncaught\s+/, '');
  // Attach stack when available for debugging.
  if (e.error instanceof Error && e.error.stack) {
    msg = `${msg}\n${e.error.stack}`;
  }
  postError(msg);
});
ctx.addEventListener('unhandledrejection', (e: PromiseRejectionEvent) => {
  const r = e.reason;
  const msg = r instanceof Error ? `${r.message}\n${r.stack ?? ''}` : String(r);
  postError(msg);
});

function progress(stageIndex: number, stageProgress: number, extra?: {
  scanned?: number;
  findings?: number;
  records?: number;
}): WorkerProgress {
  const p = Math.max(0, Math.min(1, stageProgress));
  const overall = Math.max(0, Math.min(1, (stageIndex + p) / ANALYSIS_STAGES.length));
  return {
    type: 'progress',
    stageIndex,
    stageLabel: ANALYSIS_STAGES[stageIndex] ?? 'Working',
    stageProgress: p,
    overall,
    scanned: extra?.scanned ?? 0,
    findings: extra?.findings ?? 0,
    records: extra?.records,
  };
}

function sendProgress(stageIndex: number, stageProgress: number, extra?: {
  scanned?: number;
  findings?: number;
  records?: number;
}) {
  if (cancelled) return;
  const now = performance.now();
  const stageChanged = stageIndex !== lastStage;
  const terminal = stageProgress >= 1;
  if (!stageChanged && !terminal && now - lastPost < 70) return;
  lastPost = now;
  lastStage = stageIndex;
  post(progress(stageIndex, stageProgress, extra));
}

ctx.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const msg = e.data;
  if (msg.type === 'cancel') {
    cancelled = true;
    return;
  }
  if (msg.type !== 'analyze') return;

  cancelled = false;
  replied = false;
  lastPost = 0;
  lastStage = -1;

  try {
    const result = await analyzeFile(
      msg.file ?? null,
      msg.fileName,
      msg.fileSize,
      msg.fileType,
      msg.options,
      {
        onStage: (stageIndex, stageProgress, extra) => {
          sendProgress(stageIndex, stageProgress, extra);
        },
        shouldCancel: () => cancelled,
      },
      msg.preloadedExcel,
      msg.buffer ?? null,
    );
    if (cancelled) {
      replied = true;
      post({ type: 'cancelled' });
      return;
    }
    replied = true;
    post({ type: 'done', result });
  } catch (err) {
    if (cancelled || (err instanceof Error && err.name === 'CancelledError')) {
      replied = true;
      post({ type: 'cancelled' });
      return;
    }
    const message =
      err instanceof Error ? err.message : 'Unknown error while analyzing the file.';
    postError(message);
  }
};

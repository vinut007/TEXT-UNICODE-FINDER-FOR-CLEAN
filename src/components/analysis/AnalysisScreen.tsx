import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  CircleDashed,
  FileSearch,
  Loader2,
  ScanLine,
  X,
} from 'lucide-react';
import { useStore } from '@/store/useAnalysisStore';
import { ANALYSIS_STAGES } from '@/types/analysis';
import { formatBytes, formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

export function AnalysisScreen() {
  const progress = useStore((s) => s.progress);
  const file = useStore((s) => s.file);
  const fileType = useStore((s) => s.fileType);
  const error = useStore((s) => s.analysisError);
  const cancelling = useStore((s) => s.cancelling);
  const cancelAnalysis = useStore((s) => s.cancelAnalysis);
  const goToLanding = useStore((s) => s.goToLanding);

  const stageIndex = progress?.stageIndex ?? 0;
  const overall = progress?.overall ?? 0;

  const [elapsed, setElapsed] = useState(0);
  useEffect(() => {
    const t0 = performance.now();
    const id = setInterval(() => setElapsed(performance.now() - t0), 100);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-1/2 h-[520px] w-[820px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="scan-grid absolute inset-0 opacity-60" />
      </div>

      <div className="w-full max-w-2xl animate-fade-up">
        {/* header */}
        <div className="mb-6 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-500 to-violet-600 text-white shadow-glow animate-pulse-soft">
            <ScanLine className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-extrabold tracking-tight text-ink">
            {error ? 'Analysis failed' : 'Analyzing your file'}
          </h1>
          <p className="mt-1 text-sm text-ink-muted">
            {file ? (
              <>
                <span className="font-semibold text-ink">{file.name}</span> ·{' '}
                {formatBytes(file.size)} ·{' '}
                {fileType === 'excel'
                  ? 'Excel'
                  : fileType === 'access'
                    ? 'Access'
                    : fileType === 'csv'
                      ? 'CSV/TXT'
                      : 'Text'}
              </>
            ) : null}
          </p>
        </div>

        {/* scanner visual */}
        <div className="panel relative overflow-hidden">
          <div className="relative h-40 overflow-hidden bg-surface">
            <div aria-hidden className="scan-grid absolute inset-0" />
            {/* fake document lines */}
            <div className="absolute inset-0 flex flex-col gap-2 p-5 opacity-70">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="h-2.5 rounded-full bg-line"
                  style={{ width: `${[92, 74, 86, 61, 95, 68, 80, 55][i]}%` }}
                />
              ))}
            </div>
            {/* moving scan line */}
            <div
              aria-hidden
              className="absolute inset-x-0 top-0 h-full"
              style={{ animation: 'scanline 2.4s cubic-bezier(.4,0,.6,1) infinite' }}
            >
              <div className="h-[3px] w-full bg-gradient-to-r from-transparent via-sky-400 to-transparent shadow-[0_0_24px_4px_rgba(56,189,248,.6)]" />
            </div>
            {/* corner brackets */}
            <span className="absolute left-3 top-3 h-5 w-5 border-l-2 border-t-2 border-sky-400/80" />
            <span className="absolute right-3 top-3 h-5 w-5 border-r-2 border-t-2 border-sky-400/80" />
            <span className="absolute bottom-3 left-3 h-5 w-5 border-b-2 border-l-2 border-sky-400/80" />
            <span className="absolute bottom-3 right-3 h-5 w-5 border-b-2 border-r-2 border-sky-400/80" />
          </div>

          {/* progress */}
          <div className="border-t border-line px-5 py-4">
            <div className="flex items-center justify-between text-xs">
              <span className="flex items-center gap-2 font-semibold text-ink">
                {error ? (
                  <X className="h-4 w-4 text-rose-500" />
                ) : cancelling ? (
                  <Loader2 className="h-4 w-4 animate-spin text-yellow-400" />
                ) : (
                  <Loader2 className="h-4 w-4 animate-spin text-sky-400" />
                )}
                {error
                  ? 'Stopped'
                  : cancelling
                    ? 'Cancelling…'
                    : ANALYSIS_STAGES[stageIndex] ?? 'Working'}
              </span>
              <span className="font-mono font-bold text-sky-400">
                {Math.round((error ? 0 : overall) * 100)}%
              </span>
            </div>
            <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-line">
              <div
                className="h-full rounded-full bg-gradient-to-r from-sky-500 via-sky-400 to-yellow-400 transition-all duration-300 ease-out"
                style={{ width: `${(error ? 0 : overall) * 100}%` }}
              />
            </div>

            <div className="mt-3.5 grid grid-cols-3 gap-2 text-center">
              <Stat
                label="Characters scanned"
                value={formatNumber(progress?.scanned ?? 0)}
              />
              <Stat
                label="Findings"
                value={formatNumber(progress?.findings ?? 0)}
                highlight
              />
              <Stat
                label="Elapsed"
                value={`${(elapsed / 1000).toFixed(1)}s`}
              />
            </div>
          </div>
        </div>

        {/* stage list */}
        <div className="panel mt-4 p-4">
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {ANALYSIS_STAGES.map((label, i) => {
              const state = error
                ? i < stageIndex ? 'done' : i === stageIndex ? 'active' : 'pending'
                : i < stageIndex
                  ? 'done'
                  : i === stageIndex
                    ? 'active'
                    : 'pending';
              return (
                <li
                  key={label}
                  className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs transition-colors ${
                    state === 'active'
                      ? 'bg-sky-500/10 font-semibold text-sky-400'
                      : state === 'done'
                        ? 'text-ink-muted'
                        : 'text-ink-faint'
                  }`}
                >
                  {state === 'done' ? (
                    <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-500" />
                  ) : state === 'active' ? (
                    <Loader2 className="h-3.5 w-3.5 shrink-0 animate-spin" />
                  ) : (
                    <CircleDashed className="h-3.5 w-3.5 shrink-0" />
                  )}
                  <span className="truncate">{label}</span>
                  {i === 2 && progress?.records !== undefined && progress.records > 0 ? (
                    <Badge tone="sky" className="ml-auto">
                      {formatNumber(progress.records)} rec
                    </Badge>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </div>

        {/* error / cancel */}
        {error ? (
          <div className="mt-4 rounded-xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-500 animate-fade-in">
            <p className="font-semibold">{error}</p>
            <button className="btn-ghost mt-3 !py-2 text-xs" onClick={goToLanding}>
              Back to upload
            </button>
          </div>
        ) : (
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              className="btn-ghost !py-2 text-xs"
              onClick={cancelAnalysis}
              disabled={cancelling}
            >
              <X className="h-3.5 w-3.5" />
              Cancel analysis
            </button>
            <span className="flex items-center gap-1.5 text-[11px] text-ink-faint">
              <FileSearch className="h-3.5 w-3.5" />
              Running in a Web Worker — this tab stays responsive
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-lg bg-surface px-2 py-2">
      <div className={`font-mono text-sm font-bold ${highlight ? 'text-yellow-400' : 'text-ink'}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[10px] uppercase tracking-wider text-ink-faint">{label}</div>
    </div>
  );
}

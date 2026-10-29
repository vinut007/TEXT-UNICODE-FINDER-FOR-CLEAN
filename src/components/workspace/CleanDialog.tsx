import { useMemo, useState } from 'react';
import { AlertTriangle, CheckSquare, Sparkles, Square } from 'lucide-react';
import { Dialog } from '@/components/ui/Dialog';
import { Badge } from '@/components/ui/Badge';
import { useStore } from '@/store/useAnalysisStore';
import { isGridFileType, type AnalysisResult, type CharFinding, type CleanOp } from '@/types/analysis';
import { buildReplaceAllOp, canReplace, distinctUnitCount } from './ops';
import { displayChar } from '@/lib/engine/export';
import { categoryLabel } from '@/lib/engine/scan';
import { toCodePointHex } from '@/lib/utils';
import { HIGHLIGHT_CLASS } from '@/lib/engine/unit-index';
import { cn } from '@/lib/utils';

export function CleanDialog({ result }: { result: AnalysisResult }) {
  const open = useStore((s) => s.cleanDialogOpen);
  const setOpen = useStore((s) => s.setCleanDialogOpen);
  const allowed = useStore((s) => s.allowedKeys);
  const ignored = useStore((s) => s.ignoredKeys);
  const commitBatch = useStore((s) => s.commitBatch);
  const showToast = useStore((s) => s.showToast);

  // Candidate findings: replaceable, not hidden, not allowed.
  const candidates = useMemo(
    () =>
      result.findings.filter(
        (f) => canReplace(f) && !allowed.includes(f.key) && !ignored.includes(f.key),
      ),
    [result.findings, allowed, ignored],
  );

  const [checked, setChecked] = useState<Set<string>>(
    () => new Set(candidates.filter((f) => f.severity === 'recommended').map((f) => f.key)),
  );

  const selectedOps = useMemo(
    () => candidates.filter((f) => checked.has(f.key)).map(buildReplaceAllOp),
    [candidates, checked],
  );

  const totalReplacements = selectedOps.reduce((n, op) => n + op.count, 0);
  const totalCells = candidates
    .filter((f) => checked.has(f.key))
    .reduce((n, f) => n + distinctUnitCount(f), 0);

  const mojibake = result.findings.filter((f) => f.category === 'mojibake');

  const toggle = (key: string) => {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const apply = async (ops: CleanOp[]) => {
    if (!ops.length) {
      showToast('info', 'Nothing selected to clean.');
      return;
    }
    await commitBatch(ops);
  };

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      size="xl"
      title="Clean File"
      description={
        <>
          Review and select replacement operations. Your original file is preserved — every
          change is undoable.
        </>
      }
      footer={
        <>
          <span className="mr-auto text-[11px] text-ink-faint">
            {selectedOps.length} operation{selectedOps.length === 1 ? '' : 's'} ·{' '}
            <span className="font-semibold text-yellow-500">{totalReplacements}</span>{' '}
            replacement{totalReplacements === 1 ? '' : 's'} across{' '}
            {formatCount(totalCells)} unit{totalCells === 1 ? '' : 's'}
          </span>
          <button className="btn-ghost" onClick={() => setOpen(false)}>
            Cancel
          </button>
          <button
            className="btn-secondary"
            onClick={() => void apply(candidates.map(buildReplaceAllOp))}
          >
            Clean all approved
          </button>
          <button className="btn-primary" onClick={() => void apply(selectedOps)}>
            <Sparkles className="h-4 w-4" />
            Apply selected ({selectedOps.length})
          </button>
        </>
      }
    >
      {candidates.length === 0 ? (
        <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
          <CheckSquare className="mx-auto h-7 w-7 text-emerald-500" />
          <p className="mt-2 text-sm font-bold text-emerald-500">Nothing left to clean</p>
          <p className="mt-1 text-xs text-ink-muted">
            All replaceable findings are either allowed, hidden, or already handled.
          </p>
        </div>
      ) : (
        <>
          <div className="mb-3 flex items-center justify-between">
            <p className="text-[11px] text-ink-muted">
              Recommended fixes are pre-selected. Click a row to include or exclude it.
            </p>
            <button
              className="text-[11px] font-semibold text-sky-400 hover:underline"
              onClick={() =>
                setChecked((prev) =>
                  prev.size === candidates.length
                    ? new Set()
                    : new Set(candidates.map((f) => f.key)),
                )
              }
            >
              {checked.size === candidates.length ? 'Deselect all' : 'Select all'}
            </button>
          </div>

          <ul className="space-y-1.5">
            {candidates.map((f) => {
              const on = checked.has(f.key);
              return (
                <li key={f.key}>
                  <button
                    onClick={() => toggle(f.key)}
                    aria-pressed={on}
                    className={cn(
                      'flex w-full items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition-all',
                      on
                        ? 'border-sky-500/50 bg-sky-500/[0.07]'
                        : 'border-line bg-surface hover:bg-surface-overlay',
                    )}
                  >
                    <span className="mt-0.5 shrink-0 text-ink-muted">
                      {on ? (
                        <CheckSquare className="h-4 w-4 text-sky-400" />
                      ) : (
                        <Square className="h-4 w-4" />
                      )}
                    </span>
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-surface-raised font-mono ring-1 ring-inset ring-line">
                      <span className={cn('hl !cursor-default', HIGHLIGHT_CLASS[f.category])}>
                        {displayChar(f)}
                      </span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[12px] font-bold text-ink">{f.name}</span>
                        <Badge tone={f.severity === 'recommended' ? 'yellow' : 'orange'}>
                          {f.severity === 'recommended' ? 'Recommended' : 'Review'}
                        </Badge>
                        <Badge tone="sky">{categoryLabel(f.category)}</Badge>
                      </span>
                      <span className="mt-0.5 block font-mono text-[10px] text-ink-faint">
                        {toCodePointHex(f.codePoint)} →{' '}
                        {f.suggestion ? (
                          <>
                            <span className="hl hl-whitespace !cursor-default">
                              {f.suggestion.char === ' ' ? '␣' : f.suggestion.char}
                            </span>{' '}
                            {f.suggestion.label}
                          </>
                        ) : (
                          'no suggestion'
                        )}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-ink-muted">
                        {formatCount(f.count)} occurrence{f.count === 1 ? '' : 's'} in{' '}
                        {formatCount(distinctUnitCount(f))}{' '}
                        {isGridFileType(result.fileType)
                          ? 'cell'
                          : result.fileType === 'csv'
                            ? 'field'
                            : 'line'}
                        {isGridFileType(result.fileType) && distinctUnitCount(f) === 1 ? '' : 's'}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>

          {mojibake.length > 0 ? (
            <div className="mt-3 flex items-start gap-2 rounded-lg border border-orange-500/35 bg-orange-500/[0.07] p-3">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-500" />
              <p className="text-[10.5px] leading-relaxed text-ink-muted">
                <span className="font-semibold text-orange-500">Mojibake is never auto-fixed.</span>{' '}
                {mojibake.length} pattern{mojibake.length === 1 ? '' : 's'} detected (e.g.{' '}
                {mojibake
                  .slice(0, 3)
                  .map((f) => f.name)
                  .join(', ')}
                ). Repair these by re-exporting the source with correct encoding.
              </p>
            </div>
          ) : null}
        </>
      )}
    </Dialog>
  );
}

function formatCount(n: number): string {
  return n.toLocaleString();
}

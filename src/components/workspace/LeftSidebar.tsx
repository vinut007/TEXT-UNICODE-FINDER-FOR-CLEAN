import { useMemo, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  EyeOff,
  FileText,
  Filter,
  RotateCcw,
  Search,
  ShieldCheck,
} from 'lucide-react';
import { useStore, exportErrorWords } from '@/store/useAnalysisStore';
import { useSheetCounts } from './data';
import { Badge } from '@/components/ui/Badge';
import { ANALYSIS_STAGES, isGridFileType, type AnalysisResult, type FindingCategory } from '@/types/analysis';
import { cn, formatBytes, formatDuration, formatNumber, letterToColumn } from '@/lib/utils';
import { categoryLabel } from '@/lib/engine/scan';
import { CATEGORY_COLOR } from './data';

const CATEGORY_META: { key: FindingCategory; label: string }[] = [
  { key: 'non-ascii', label: 'Non-ASCII' },
  { key: 'whitespace', label: 'Unicode whitespace' },
  { key: 'invisible', label: 'Invisible / format' },
  { key: 'control', label: 'Control' },
  { key: 'mojibake', label: 'Mojibake' },
  { key: 'bom', label: 'BOM' },
];

export function LeftSidebar({ result }: { result: AnalysisResult }) {
  const filters = useStore((s) => s.filters);
  const setFilters = useStore((s) => s.setFilters);
  const toggleCategory = useStore((s) => s.toggleCategory);
  const ignored = useStore((s) => s.ignoredKeys);
  const allowed = useStore((s) => s.allowedKeys);
  const unignoreFinding = useStore((s) => s.unignoreFinding);
  const reset = useStore((s) => s.reset);
  const navigate = useStore((s) => s.navigate);
  const activeSheet = useStore((s) => s.activeSheet);
  const setActiveSheet = useStore((s) => s.setActiveSheet);
  const showToast = useStore((s) => s.showToast);
  const sheetCounts = useSheetCounts(result);

  const [jump, setJump] = useState('');

  const catCounts = useMemo(() => {
    const map = new Map<FindingCategory, number>();
    for (const f of result.findings) {
      if (ignored.includes(f.key)) continue;
      map.set(f.category, (map.get(f.category) ?? 0) + 1);
    }
    return map;
  }, [result.findings, ignored]);

  const totalFindings = useMemo(
    () => result.findings.filter((f) => !ignored.includes(f.key)).length,
    [result.findings, ignored],
  );

  const handleJump = () => {
    const value = jump.trim();
    if (!value) return;
    if (result.fileType === 'text') {
      const n = parseInt(value, 10);
      if (Number.isNaN(n) || n < 1) {
        showToast('error', 'Enter a line number (1 or greater).');
        return;
      }
      navigate({ line: n });
    } else if (result.fileType === 'csv') {
      const n = parseInt(value, 10);
      if (Number.isNaN(n) || n < 1) {
        showToast('error', 'Enter a row number (1 or greater).');
        return;
      }
      navigate({ row: n });
    } else {
      const m = /^([A-Za-z]{1,3})(\d{1,7})$/.exec(value);
      if (!m) {
        showToast('error', 'Enter a cell reference such as C27.');
        return;
      }
      const col = letterToColumn(m[1]);
      const row = parseInt(m[2], 10);
      navigate({ sheet: activeSheet ?? undefined, row, col, cell: `${m[1].toUpperCase()}${row}` });
    }
  };

  const jumpLabel =
    result.fileType === 'text'
      ? 'Line number'
      : result.fileType === 'csv'
        ? 'Row number'
        : 'Cell (e.g. C27)';

  return (
    <div className="flex h-full min-h-0 flex-col gap-3 overflow-y-auto bg-surface-raised p-3">
      {/* file overview */}
      <section className="rounded-xl border border-line bg-surface p-3">
        <div className="flex items-start gap-2.5">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-sky-500/12 text-sky-400">
            <FileText className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-bold text-ink" title={result.fileName}>
              {result.fileName}
            </p>
            <p className="text-[11px] text-ink-muted">
              {formatBytes(result.fileSize)} ·{' '}
              {result.fileType === 'excel'
                ? 'Excel'
                : result.fileType === 'access'
                  ? 'Access'
                  : result.fileType === 'csv'
                    ? 'CSV / TSV'
                    : 'Text'}
            </p>
          </div>
        </div>

        <dl className="mt-3 space-y-1.5 text-[11px]">
          <div className="flex justify-between gap-2">
            <dt className="text-ink-faint">Encoding</dt>
            <dd className="flex items-center gap-1 text-right font-semibold text-ink">
              {result.encoding}
              {result.hasBom ? <Badge tone="sky">BOM</Badge> : null}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-faint">Format</dt>
            <dd className="text-right font-semibold text-ink">{result.formatDetail}</dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-faint">Status</dt>
            <dd className="flex items-center gap-1 text-right font-semibold text-emerald-500">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Scanned in {formatDuration(result.durationMs)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-faint">Characters scanned</dt>
            <dd className="font-mono font-semibold text-ink">
              {formatNumber(result.stats.totalCodePoints)}
            </dd>
          </div>
          <div className="flex justify-between gap-2">
            <dt className="text-ink-faint">Findings</dt>
            <dd className="font-mono font-semibold text-yellow-500">
              {formatNumber(totalFindings)}
            </dd>
          </div>
        </dl>

        <div className="mt-2.5 flex items-start gap-1.5 rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-2 py-1.5 text-[10px] leading-relaxed text-emerald-500">
          <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          Processed locally in your browser — stage 8/8 complete ({ANALYSIS_STAGES.length} stages)
        </div>
      </section>

      {result.warnings.length > 0 ? (
        <section className="space-y-1.5 rounded-xl border border-yellow-400/35 bg-yellow-400/[0.07] p-3">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-yellow-500">
            <AlertTriangle className="h-3.5 w-3.5" /> Warnings
          </div>
          {result.warnings.map((w, i) => (
            <p key={i} className="text-[10.5px] leading-relaxed text-ink-muted">
              {w}
            </p>
          ))}
        </section>
      ) : null}

      {/* worksheets / tables */}
      {result.excel ? (
        <section className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            {result.fileType === 'access' ? 'Tables' : 'Worksheets'}
          </div>
          <div className="mt-2 flex max-h-40 flex-col gap-1 overflow-y-auto pr-1">
            {result.excel.sheets.map((s) => (
              <button
                key={s.name}
                onClick={() => setActiveSheet(s.name)}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md px-2 py-1.5 text-left text-[11px] font-semibold transition-colors',
                  s.name === activeSheet
                    ? 'bg-sky-500/15 text-sky-400 ring-1 ring-inset ring-sky-500/40'
                    : 'text-ink-muted hover:bg-surface-overlay hover:text-ink',
                )}
              >
                <span className="truncate">{s.name}</span>
                <span
                  className={cn(
                    'shrink-0 rounded px-1.5 py-0.5 font-mono text-[9px] font-bold',
                    (sheetCounts.get(s.name) ?? 0) > 0
                      ? 'bg-yellow-400/20 text-yellow-500'
                      : 'bg-line/60 text-ink-faint',
                  )}
                >
                  {sheetCounts.get(s.name) ?? 0}
                </span>
              </button>
            ))}
          </div>
        </section>
      ) : null}

      {/* filters */}
      <section className="rounded-xl border border-line bg-surface p-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            <Filter className="h-3 w-3" /> Filters
          </div>
          <span className="text-[10px] text-ink-faint">{totalFindings} visible</span>
        </div>

        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            value={filters.search}
            onChange={(e) => setFilters({ search: e.target.value })}
            placeholder="Search findings…"
            className="input !py-1.5 !pl-8 text-[11px]"
            aria-label="Search findings"
          />
        </div>

        <div className="mt-2 flex flex-wrap gap-1.5">
          {CATEGORY_META.map((c) => {
            const on = filters.categories.includes(c.key);
            const count = catCounts.get(c.key) ?? 0;
            return (
              <button
                key={c.key}
                onClick={() => toggleCategory(c.key)}
                aria-pressed={on}
                className={cn(
                  'flex items-center gap-1.5 rounded-md border px-2 py-1 text-[10px] font-semibold transition-all',
                  on
                    ? 'border-sky-500/50 bg-sky-500/10 text-ink'
                    : 'border-line text-ink-faint opacity-70 hover:opacity-100',
                )}
                title={`${categoryLabel(c.key)} — ${count} findings`}
              >
                <span className={cn('h-2 w-2 shrink-0 rounded-full', CATEGORY_COLOR[c.key])} />
                {c.label}
                <span className={cn('font-mono', count > 0 ? 'text-yellow-500' : 'text-ink-faint')}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-2.5">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            Severity
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(
              [
                ['all', 'All'],
                ['recommended', 'Recommended'],
                ['review', 'Review'],
                ['none', 'No action'],
              ] as const
            ).map(([value, label]) => (
              <button
                key={value}
                onClick={() => setFilters({ severity: value })}
                className={cn(
                  'rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors',
                  filters.severity === value
                    ? 'border-yellow-400/60 bg-yellow-400/15 text-yellow-500'
                    : 'border-line text-ink-muted hover:text-ink',
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* quick jump */}
      <section className="rounded-xl border border-line bg-surface p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
          Quick jump
        </div>
        <div className="mt-2 flex gap-1.5">
          <input
            value={jump}
            onChange={(e) => setJump(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJump()}
            placeholder={jumpLabel}
            className="input !py-1.5 text-[11px]"
            aria-label={`Jump to ${jumpLabel}`}
          />
          <button className="btn-primary shrink-0 !px-3 !py-1.5 !text-[11px]" onClick={handleJump}>
            Go
          </button>
        </div>
      </section>

      {/* ignored / allowed */}
      {(ignored.length > 0 || allowed.length > 0) && (
        <section className="rounded-xl border border-line bg-surface p-3">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint">
            <EyeOff className="h-3 w-3" /> Ignored &amp; allowed
          </div>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {ignored.map((key) => (
              <button
                key={`ig-${key}`}
                onClick={() => {
                  unignoreFinding(key);
                  showToast('info', 'Restored hidden character type.');
                }}
                className="flex items-center gap-1 rounded-md border border-violet-500/40 bg-violet-500/10 px-2 py-1 text-[10px] font-semibold text-violet-500 hover:bg-violet-500/20"
                title="Click to restore"
              >
                {key.split(':')[0] === 'mojibake' ? 'mojibake' : key.split(':')[1]} · restore ✕
              </button>
            ))}
            {allowed.map((key) => (
              <button
                key={`al-${key}`}
                onClick={() => {
                  unignoreFinding(key);
                  showToast('info', 'Removed from allowed list.');
                }}
                className="flex items-center gap-1 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-500 hover:bg-emerald-500/20"
                title="Click to remove from allowed list"
              >
                {key.startsWith('mojibake:')
                  ? `mojibake ${key.slice('mojibake:'.length)}`
                  : `U+${key.split(':')[1]}`}{' '}
                allowed ✕
              </button>
            ))}
          </div>
        </section>
      )}

      {/* danger zone */}
      <section className="mt-auto rounded-xl border border-rose-500/30 bg-rose-500/[0.06] p-3">
        <p className="text-[10.5px] leading-relaxed text-ink-muted">
          Clear File drops every in-memory copy of your data immediately.
        </p>
        <button className="btn-danger mt-2 w-full !py-1.5 !text-[11px]" onClick={reset}>
          <RotateCcw className="h-3.5 w-3.5" />
          Clear File &amp; Reset Analysis
        </button>

        <div className="mt-2 rounded-xl border border-line bg-surface p-2">
          <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-ink-faint mb-1">
            <Download className="h-3 w-3" /> Export
          </div>
          <button className="w-full flex items-center justify-between border border-line bg-surface-raised rounded px-2 py-1.5 text-[11px] text-ink hover:bg-yellow-400/5 hover:border-yellow-400/30" onClick={exportErrorWords}>
            <span className="truncate">Export error words (CSV)</span>
            <span className="text-ink-faint">Code Point · character · replace</span>
          </button>
        </div>
      </section>
    </div>
  );
}

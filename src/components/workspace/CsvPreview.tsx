import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Filter, Rows3 } from 'lucide-react';
import { useStore } from '@/store/useAnalysisStore';
import { useVirtualRows } from '@/hooks/useVirtualRows';
import { useCharMap, useVisibleIndex, useCsvRowsWithFindings } from './data';
import { HighlightedText } from '@/components/ui/HighlightedText';
import type { AnalysisResult } from '@/types/analysis';
import { cn, columnToLetter } from '@/lib/utils';
import { visible as escapeVisible } from '@/lib/engine/scan';
import { Badge } from '@/components/ui/Badge';

const ROW_H = 34;
const COL_W = 200;
const ROWNUM_W = 60;
const MAX_COLS = 600;

export function CsvPreview({ result }: { result: AnalysisResult }) {
  const csv = result.csv!;
  const charMap = useCharMap(result);
  const index = useVisibleIndex(result);
  const rowsWithFindings = useCsvRowsWithFindings(index);
  const nav = useStore((s) => s.nav);
  const selectFinding = useStore((s) => s.selectFinding);
  const selectedLocationId = useStore((s) => s.selectedLocationId);

  const [query, setQuery] = useState('');
  const [onlyFindings, setOnlyFindings] = useState(false);
  const [colFilter, setColFilter] = useState<number | 'all'>('all');

  const containerRef = useRef<HTMLDivElement>(null);
  const [flashRow, setFlashRow] = useState<number | null>(null);

  const hasHeader = csv.hasHeader;
  const headerRow = hasHeader ? csv.records[0] : csv.headers;
  const colCount = useMemo(() => {
    let max = headerRow?.length ?? 0;
    const limit = Math.min(csv.records.length, 400);
    for (let i = 0; i < limit; i++) max = Math.max(max, csv.records[i].length);
    return Math.min(Math.max(max, 1), MAX_COLS);
  }, [csv.records, headerRow]);

  const columns = useMemo(() => {
    const all = Array.from({ length: colCount }, (_, i) => ({
      index: i,
      name: headerRow?.[i] || `Column ${i + 1}`,
      hasFinding: false,
    }));
    // Derive which columns contain findings from the unit index (O(findings))
    // instead of scanning every cell (O(cols × rows), which freezes on large files).
    for (const key of index.keys()) {
      const colon = key.indexOf(':');
      if (colon !== -1) {
        const c = Number(key.slice(colon + 1));
        if (!Number.isNaN(c) && c >= 0 && c < colCount) all[c].hasFinding = true;
      }
    }
    return all;
  }, [colCount, headerRow, index]);

  const visibleColumns = useMemo(
    () => (colFilter === 'all' ? columns : columns.filter((c) => c.index === colFilter)),
    [columns, colFilter],
  );

  const rowList = useMemo(() => {
    const start = hasHeader ? 1 : 0;
    const q = query.trim().toLowerCase();
    const out: number[] = [];
    for (let r = start; r < csv.records.length; r++) {
      if (onlyFindings && !rowsWithFindings.has(r)) continue;
      if (q) {
        const row = csv.records[r];
        let found = false;
        for (let c = 0; c < row.length; c++) {
          if (row[c].toLowerCase().includes(q)) {
            found = true;
            break;
          }
        }
        if (!found) continue;
      }
      out.push(r);
    }
    return out;
  }, [csv.records, hasHeader, query, onlyFindings, rowsWithFindings]);

  const { start, end, padTop, padBottom, totalHeight, scrollToRow } = useVirtualRows(
    containerRef,
    rowList.length,
    ROW_H,
  );

  const displayNumber = (recordIndex: number) => (hasHeader ? recordIndex : recordIndex + 1);

  const rowListRef = useRef<number[]>(rowList);
  useEffect(() => {
    rowListRef.current = rowList;
  }, [rowList]);

  // navigation (row + column jump)
  useEffect(() => {
    if (!nav?.row) return;
    const recordIndex = hasHeader ? nav.row : nav.row - 1;
    setQuery('');
    setOnlyFindings(false);    if (colFilter !== 'all' && nav.col !== undefined && nav.col - 1 !== colFilter) {
      setColFilter('all');
    }
    // allow state to flush before scrolling
    const t = setTimeout(() => {
      const list = rowListRef.current;
      const pos = list.indexOf(recordIndex);
      if (pos >= 0) {
        scrollToRow(pos);
        setFlashRow(recordIndex);
        setTimeout(() => setFlashRow(null), 1600);
      }
      if (nav.col !== undefined) {
        const el = containerRef.current;
        if (el) {
          const target =
            ROWNUM_W + (nav.col - 1) * COL_W - Math.max(0, el.clientWidth - ROWNUM_W) / 2;
          el.scrollTo({ left: Math.max(0, target), behavior: 'smooth' });
        }
      }
    }, 30);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav?.token]);

  const visibleRows = useMemo(() => rowList.slice(start, end), [rowList, start, end]);
  const findingCols = columns.filter((c) => c.hasFinding);

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface-raised px-3 py-2">
        <div className="relative">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-ink-faint" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search values…"
            className="input !w-52 !py-1.5 !pl-8 text-xs"
            aria-label="Search CSV values"
          />
        </div>
        <button
          onClick={() => setOnlyFindings((v) => !v)}
          className={cn(
            'btn !px-2.5 !py-1.5 text-[11px]',
            onlyFindings
              ? 'bg-yellow-400/15 text-yellow-500 ring-1 ring-inset ring-yellow-400/40'
              : 'border border-line text-ink-muted hover:text-ink',
          )}
          aria-pressed={onlyFindings}
        >
          <Rows3 className="h-3.5 w-3.5" />
          Rows with findings ({rowsWithFindings.size})
        </button>
        <div className="flex items-center gap-1.5">
          <Filter className="h-3.5 w-3.5 text-ink-faint" />
          <select
            value={colFilter === 'all' ? 'all' : String(colFilter)}
            onChange={(e) =>
              setColFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
            }
            className="input !w-44 !py-1.5 text-[11px]"
            aria-label="Filter visible column"
          >
            <option value="all">All columns ({colCount})</option>
            {columns.slice(0, 200).map((c) => (
              <option key={c.index} value={c.index}>
                {c.name}
                {c.hasFinding ? ' •' : ''}
              </option>
            ))}
          </select>
        </div>
        <div className="ml-auto flex items-center gap-2 text-[11px] text-ink-faint">
          <Badge tone="sky">
            {rowList.length.toLocaleString()} / {Math.max(0, csv.records.length - (hasHeader ? 1 : 0)).toLocaleString()} rows
          </Badge>
          <Badge tone="yellow">{findingCols.length} cols with hits</Badge>
        </div>
      </div>

      {/* grid */}
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto bg-surface">
        <div className="min-w-max" style={{ width: ROWNUM_W + visibleColumns.length * COL_W }}>
          {/* header */}
          <div
            className="sticky top-0 z-20 flex border-b border-line bg-surface-raised shadow-[0_2px_8px_-4px_rgba(0,0,0,.4)]"
            style={{ height: ROW_H }}
          >
            <div
              className="sticky left-0 z-30 flex shrink-0 items-center justify-end border-r border-line bg-surface-raised pr-2 text-[10px] font-bold text-ink-faint"
              style={{ width: ROWNUM_W }}
            >
              #
            </div>
            {visibleColumns.map((c) => (
              <div
                key={c.index}
                className={cn(
                  'flex shrink-0 items-center gap-1.5 overflow-hidden border-r border-line px-2 text-[11px] font-bold',
                  c.hasFinding ? 'text-yellow-500' : 'text-ink-muted',
                )}
                style={{ width: COL_W }}
                title={`Column ${c.index + 1}${c.hasFinding ? ' — contains findings' : ''}`}
              >
                <span className="shrink-0 font-mono text-ink-faint">
                  {columnToLetter(c.index + 1)}
                </span>
                <span className="truncate">{c.name}</span>
              </div>
            ))}
          </div>

          {/* rows */}
          <div style={{ height: padTop }} />
          {visibleRows.map((recordIndex) => {
            const row = csv.records[recordIndex];
            const flashing = flashRow === recordIndex;
            return (
              <div
                key={recordIndex}
                className={cn(
                  'group flex border-b border-line/70 transition-colors hover:bg-sky-500/[0.05]',
                  flashing && 'nav-flash',
                )}
                style={{ height: ROW_H }}
              >
                <div
                  className={cn(
                    'sticky left-0 z-10 flex shrink-0 items-center justify-end border-r border-line bg-surface-raised pr-2 font-mono text-[11px] tabular-nums group-hover:text-sky-400',
                    flashing && 'text-sky-400',
                  )}
                  style={{ width: ROWNUM_W }}
                >
                  {displayNumber(recordIndex)}
                </div>
                {visibleColumns.map((c) => {
                  const raw = row[c.index] ?? '';
                  const display = cellDisplay(raw);
                  return (
                    <div
                      key={c.index}
                      className={cn(
                        'flex shrink-0 items-center overflow-hidden border-r border-line px-2 text-[12px] text-ink',
                        raw === '' && 'bg-surface/60',
                      )}
                      style={{ width: COL_W }}
                      title={raw.length > 120 ? raw.slice(0, 400) : undefined}
                    >
                      <span className="truncate">
                        {display === '' ? (
                          <span className="text-ink-faint/40">—</span>
                        ) : (
                          <HighlightedText
                            text={display}
                            charMap={charMap}
                            onHit={(h) => selectFinding(h.findingKey, h.loc)}
                            selectedId={selectedLocationId}
                          />
                        )}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
          <div style={{ height: padBottom }} />
          {rowList.length === 0 ? (
            <div className="flex h-32 items-center justify-center text-sm text-ink-faint">
              No rows match the current filters.
            </div>
          ) : null}
        </div>
      </div>

      {/* status */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-raised px-3 py-1.5 text-[11px] text-ink-muted">
        <span>
          {visibleRows.length > 0
            ? `Showing rows ${displayNumber(visibleRows[0])}–${displayNumber(visibleRows[visibleRows.length - 1])}`
            : 'No rows'}
          {' · '}delimiter{' '}
          <span className="font-mono text-ink">{escapeVisible(csv.delimiter)}</span>
          {' · '}positions = Unicode code points (1-based)
        </span>
        <span className="text-ink-faint">
          {colCount} columns · {hasHeader ? 'header row detected' : 'no header detected'}
        </span>
      </div>
    </div>
  );
}

/** Same-length display transform so highlight offsets stay aligned. */
function cellDisplay(raw: string): string {
  if (!raw) return '';
  if (!/[\n\r\t]/.test(raw)) return raw;
  return raw.replace(/\n/g, '⏎').replace(/\r/g, '·').replace(/\t/g, '→');
}

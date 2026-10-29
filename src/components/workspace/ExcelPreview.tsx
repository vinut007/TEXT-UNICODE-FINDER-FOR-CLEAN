import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store/useAnalysisStore';
import { useCharMap, useSheetCounts } from './data';
import { HighlightedText } from '@/components/ui/HighlightedText';
import type { AnalysisResult } from '@/types/analysis';
import { cellRef, cn, columnToLetter, formatNumber } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

const ROW_H = 26;
const COL_W = 156;
const ROWNUM_W = 56;
const HEAD_H = 26;
const MAX_COLS = 600;
const MAX_ROWS = 500_000;

export function ExcelPreview({ result }: { result: AnalysisResult }) {
  const excel = result.excel!;
  const charMap = useCharMap(result);
  const sheetCounts = useSheetCounts(result);
  const activeSheet = useStore((s) => s.activeSheet);
  const setActiveSheet = useStore((s) => s.setActiveSheet);
  const selectFinding = useStore((s) => s.selectFinding);
  const setInspectedCell = useStore((s) => s.setInspectedCell);
  const inspectedCell = useStore((s) => s.inspectedCell);
  const selectedLocationId = useStore((s) => s.selectedLocationId);
  const nav = useStore((s) => s.nav);

  const containerRef = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ top: 0, left: 0, w: 900, h: 500 });
  const [flash, setFlash] = useState<{ r: number; c: number } | null>(null);

  const sheetName = activeSheet ?? excel.sheets[0]?.name ?? '';
  const sheet = useMemo(
    () => excel.sheets.find((s) => s.name === sheetName) ?? excel.sheets[0],
    [excel.sheets, sheetName],
  );

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        setScroll((s) => ({ ...s, top: el.scrollTop, left: el.scrollLeft }));
      });
    };
    const onResize = () =>
      setScroll((s) => ({ ...s, w: el.clientWidth, h: el.clientHeight }));
    onResize();
    el.addEventListener('scroll', onScroll, { passive: true });
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    return () => {
      el.removeEventListener('scroll', onScroll);
      ro.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const rowCount = Math.min(sheet?.rowCount ?? 0, MAX_ROWS);
  const colCount = Math.min(sheet?.colCount ?? 0, MAX_COLS);
  const startRow = sheet?.startRow ?? 1;
  const startCol = sheet?.startCol ?? 1;

  const rowStart = Math.max(0, Math.floor(scroll.top / ROW_H) - 6);
  const rowEnd = Math.min(rowCount, Math.ceil((scroll.top + scroll.h) / ROW_H) + 6);
  const colStart = Math.max(0, Math.floor(scroll.left / COL_W) - 4);
  const colEnd = Math.min(colCount, Math.ceil((scroll.left + scroll.w) / COL_W) + 6);

  const padLeft = colStart * COL_W;
  const padRight = Math.max(0, (colCount - colEnd) * COL_W);
  const padTop = rowStart * ROW_H;
  const padBottom = Math.max(0, (rowCount - rowEnd) * ROW_H);

  // navigation
  useEffect(() => {
    if (!nav) return;
    const el = containerRef.current;
    if (nav.sheet && nav.sheet !== sheetName) {
      setActiveSheet(nav.sheet);
    }
    if (!el) return;
    const targetSheet = nav.sheet ?? sheetName;
    const sh = excel.sheets.find((s) => s.name === targetSheet);
    if (!sh) return;
    if (nav.row !== undefined) {
      const r = nav.row - sh.startRow;
      el.scrollTo({ top: Math.max(0, r * ROW_H - el.clientHeight / 3), behavior: 'smooth' });
    }
    if (nav.col !== undefined) {
      const c = nav.col - sh.startCol;
      el.scrollTo({
        left: Math.max(0, c * COL_W - Math.max(0, el.clientWidth - ROWNUM_W) / 2),
        behavior: 'smooth',
      });
    }
    if (nav.row !== undefined && nav.col !== undefined) {
      setFlash({ r: nav.row - sh.startRow, c: nav.col - sh.startCol });
      const t = setTimeout(() => setFlash(null), 1600);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nav?.token]);

  if (!sheet) {
    return (
      <div className="grid h-full place-items-center text-sm text-ink-faint">
        {result.fileType === 'access'
          ? 'Database contains no readable tables.'
          : 'Workbook contains no readable worksheets.'}
      </div>
    );
  }

  const rows = sheet.rows;
  const visibleRowsIdx: number[] = [];
  for (let r = rowStart; r < rowEnd; r++) visibleRowsIdx.push(r);
  const visibleColsIdx: number[] = [];
  for (let c = colStart; c < colEnd; c++) visibleColsIdx.push(c);

  const selectedRef =
    inspectedCell && inspectedCell.sheet === sheetName
      ? cellRef(inspectedCell.row, inspectedCell.col)
      : null;

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* worksheet tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto border-b border-line bg-surface-raised px-3 py-1.5">
        {excel.sheets.map((s) => {
          const active = s.name === sheetName;
          const count = sheetCounts.get(s.name) ?? 0;
          return (
            <button
              key={s.name}
              onClick={() => setActiveSheet(s.name)}
              className={cn(
                'flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1 text-[11px] font-semibold transition-colors',
                active
                  ? 'bg-sky-500 text-white'
                  : 'text-ink-muted hover:bg-surface-overlay hover:text-ink',
              )}
              title={`${s.rowCount} rows × ${s.colCount} columns`}
            >
              {s.name}
              {count > 0 ? (
                <span
                  className={cn(
                    'rounded px-1 text-[9px] font-bold',
                    active ? 'bg-white/25' : 'bg-yellow-400/20 text-yellow-500',
                  )}
                >
                  {count}
                </span>
              ) : null}
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2">
          <Badge tone="sky">
            {formatNumber(sheet.rowCount)} × {formatNumber(sheet.colCount)}
          </Badge>
          {selectedRef ? <Badge tone="yellow">{selectedRef}</Badge> : null}
        </div>
      </div>

      {/* grid */}
      <div ref={containerRef} className="relative min-h-0 flex-1 overflow-auto bg-surface">
        <div className="min-w-max" style={{ width: ROWNUM_W + colCount * COL_W }}>
          {/* column header */}
          <div
            className="sticky top-0 z-20 flex bg-surface-raised shadow-[0_2px_8px_-4px_rgba(0,0,0,.4)]"
            style={{ height: HEAD_H }}
          >
            <div
              className="sticky left-0 z-30 flex shrink-0 items-center justify-end border-b border-r border-line bg-surface-raised pr-1.5 text-[9px] font-bold text-ink-faint"
              style={{ width: ROWNUM_W, height: HEAD_H }}
            />
            <div className="flex" style={{ paddingLeft: padLeft, height: HEAD_H }}>
              {visibleColsIdx.map((c) => (
                <div
                  key={c}
                  className={cn(
                    'flex shrink-0 items-center justify-center border-b border-r border-line font-mono text-[10px] font-bold',
                    startCol + c === inspectedCell?.col && inspectedCell.sheet === sheetName
                      ? 'bg-yellow-400/20 text-yellow-500'
                      : 'text-ink-faint',
                  )}
                  style={{ width: COL_W }}
                >
                  {columnToLetter(startCol + c)}
                </div>
              ))}
              <div style={{ width: padRight }} />
            </div>
          </div>

          {/* body */}
          <div style={{ height: padTop }} />
          {visibleRowsIdx.map((r) => {
            const row = rows[r] ?? [];
            const absRow = startRow + r;
            return (
              <div key={r} className="flex" style={{ height: ROW_H }}>
                <div
                  className={cn(
                    'sticky left-0 z-10 flex shrink-0 items-center justify-end border-b border-r border-line bg-surface-raised pr-1.5 font-mono text-[10px] tabular-nums',
                    absRow === inspectedCell?.row && inspectedCell.sheet === sheetName
                      ? 'bg-yellow-400/20 text-yellow-500'
                      : 'text-ink-faint',
                  )}
                  style={{ width: ROWNUM_W }}
                >
                  {absRow}
                </div>
                <div className="flex" style={{ paddingLeft: padLeft }}>
                  {visibleColsIdx.map((c) => {
                    const absCol = startCol + c;
                    const value = row[c] ?? '';
                    const isFlashing = flash && flash.r === r && flash.c === c;
                    const isSelected =
                      inspectedCell &&
                      inspectedCell.sheet === sheetName &&
                      inspectedCell.row === absRow &&
                      inspectedCell.col === absCol;
                    return (
                      <div
                        key={c}
                        role="button"
                        tabIndex={0}
                        onClick={() => setInspectedCell({ sheet: sheetName, row: absRow, col: absCol })}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            setInspectedCell({ sheet: sheetName, row: absRow, col: absCol });
                          }
                        }}
                        className={cn(
                          'flex shrink-0 items-center overflow-hidden border-b border-r border-line px-1.5 text-[12px] text-ink transition-colors',
                          isSelected
                            ? 'bg-sky-500/10 ring-1 ring-inset ring-sky-500'
                            : 'hover:bg-sky-500/[0.06]',
                          isFlashing && 'nav-flash',
                        )}
                        style={{ width: COL_W }}
                        title={`${sheetName}!${cellRef(absRow, absCol)}`}
                      >
                        <span className="truncate">
                          {value === '' ? (
                            <span className="text-ink-faint/30">·</span>
                          ) : (
                            <HighlightedText
                              text={value}
                              charMap={charMap}
                              onHit={(h) => selectFinding(h.findingKey, h.loc)}
                              selectedId={selectedLocationId}
                            />
                          )}
                        </span>
                      </div>
                    );
                  })}
                  <div style={{ width: padRight }} />
                </div>
              </div>
            );
          })}
          <div style={{ height: padBottom }} />
        </div>
      </div>

      {/* status */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-raised px-3 py-1.5 text-[11px] text-ink-muted">
        <span>
          {selectedRef ? (
            <>
              <span className="font-semibold text-sky-400">{selectedRef}</span> in{' '}
              <span className="font-semibold text-ink">{sheetName}</span>
            </>
          ) : (
            <>
              {result.fileType === 'access' ? 'Table' : 'Sheet'}{' '}
              <span className="font-semibold text-ink">{sheetName}</span> — click a cell to
              inspect it
            </>
          )}
        </span>
        <span className="text-ink-faint">
          {result.fileType === 'access' ? 'Table' : 'Excel'} coordinates · A1 = row 1, column 1 ·
          displayed values are cell text
        </span>
      </div>
    </div>
  );
}

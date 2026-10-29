import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '@/store/useAnalysisStore';
import { useVirtualRows } from '@/hooks/useVirtualRows';
import { useCharMap } from './data';
import { HighlightedText } from '@/components/ui/HighlightedText';
import { renderSegments, HIGHLIGHT_CLASS, escapeChar, type CharMap, type IndexedHit } from '@/lib/engine/unit-index';
import type { AnalysisResult } from '@/types/analysis';
import { cn, toCodePointHex } from '@/lib/utils';
import { Badge } from '@/components/ui/Badge';

const ROW_H = 22;
const GUTTER = 76;

export function TextPreview({ result }: { result: AnalysisResult }) {
  const lines = useMemo(() => result.lines ?? [], [result]);
  const charMap = useCharMap(result);
  const escapedView = useStore((s) => s.escapedView);
  const nav = useStore((s) => s.nav);
  const selectFinding = useStore((s) => s.selectFinding);
  const selectedLocationId = useStore((s) => s.selectedLocationId);
  const containerRef = useRef<HTMLDivElement>(null);
  const [flashLine, setFlashLine] = useState<number | null>(null);

  const { start, end, padTop, padBottom, totalHeight, scrollToRow } = useVirtualRows(
    containerRef,
    lines.length,
    ROW_H,
  );

  // navigate on nav change
  useEffect(() => {
    if (!nav?.line) return;
    const target = nav.line - 1;
    if (target < 0 || target >= lines.length) return;
    setFlashLine(nav.line);
    scrollToRow(target);
    const t = setTimeout(() => setFlashLine(null), 1600);
    return () => clearTimeout(t);
  }, [nav?.token, nav?.line, lines.length, scrollToRow]);

  const selectedLoc = useMemo(() => {
    if (!selectedLocationId) return null;
    for (const f of result.findings) {
      const l = f.locations.find((x) => x.id === selectedLocationId);
      if (l) return l;
    }
    return null;
  }, [result, selectedLocationId]);

  const visible = useMemo(() => lines.slice(start, end), [lines, start, end]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div
        ref={containerRef}
        className="relative min-h-0 flex-1 overflow-auto bg-surface font-mono text-[12.5px] leading-[22px]"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="min-w-max" style={{ height: totalHeight }}>
          <div style={{ paddingTop: padTop }}>
            {visible.map((line, i) => {
              const lineNo = start + i + 1;
              const flashing = flashLine === lineNo;
              const selectedHere = selectedLoc?.line === lineNo;
              return (
                <div
                  key={lineNo}
                  className={cn(
                    'group flex min-w-full items-start hover:bg-sky-500/[0.06]',
                    flashing && 'nav-flash',
                    selectedHere && 'bg-sky-500/[0.08]',
                  )}
                  style={{ height: ROW_H }}
                >
                  <div
                    className={cn(
                      'sticky left-0 z-10 flex h-[22px] shrink-0 select-none items-center justify-end border-r border-line bg-surface-raised pr-2 text-[11px] tabular-nums text-ink-faint group-hover:text-sky-400',
                      selectedHere && 'text-sky-400',
                    )}
                    style={{ width: GUTTER }}
                  >
                    {lineNo}
                  </div>
                  <code className="whitespace-pre pl-3 pr-6 text-ink">
                    {line.length === 0 ? (
                      <span className="text-ink-faint/50"> </span>
                    ) : escapedView ? (
                      <EscapedLine
                        line={line}
                        charMap={charMap}
                        onHit={(h) => selectFinding(h.findingKey, h.loc)}
                        selectedId={selectedLocationId}
                      />
                    ) : (
                      <HighlightedText
                        text={line}
                        charMap={charMap}
                        onHit={(h) => selectFinding(h.findingKey, h.loc)}
                        selectedId={selectedLocationId}
                      />
                    )}
                  </code>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* status bar */}
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-t border-line bg-surface-raised px-3 py-1.5 text-[11px] text-ink-muted">
        <div className="flex items-center gap-3">
          {selectedLoc ? (
            <span className="font-mono text-sky-400">
              Ln {selectedLoc.line}, Col {selectedLoc.column} · pos {selectedLoc.filePos}
            </span>
          ) : (
            <span>{result.formatDetail}</span>
          )}
          <span className="text-ink-faint">· {lines.length.toLocaleString()} lines</span>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={escapedView ? 'yellow' : 'zinc'}>
            {escapedView ? 'Escaped view — invisible chars shown as \\uXXXX' : 'Natural view'}
          </Badge>
          <span className="hidden text-ink-faint sm:inline">
            positions = Unicode code points (1-based)
          </span>
        </div>
      </div>
    </div>
  );
}

/** Escaped rendering: hit segments displayed as literal escape sequences. */
function EscapedLine({
  line,
  charMap,
  onHit,
  selectedId,
}: {
  line: string;
  charMap: CharMap;
  onHit: (h: IndexedHit) => void;
  selectedId: string | null;
}) {
  const segs = renderSegments(line, charMap);
  return (
    <>
      {segs.map((seg, i) => {
        if (!seg.hit) {
          return <span key={i}>{escapeAsciiControls(seg.text)}</span>;
        }
        const h = seg.hit;
        const cp = h.char.codePointAt(0)!;
        let shown = seg.text;
        if (!h.isSequence) {
          const esc = escapeChar(cp);
          if (esc) shown = esc;
          else if (h.category === 'whitespace' || h.category === 'invisible' || h.category === 'bom') {
            shown = `\\u${toCodePointHex(cp).slice(2)}`;
          }
        }
        return (
          <span
            key={i}
            role="button"
            tabIndex={0}
            className={cn('hl', HIGHLIGHT_CLASS[h.category], h.loc.id === selectedId && 'selected')}
            onClick={(e) => {
              e.stopPropagation();
              onHit(h);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onHit(h);
              }
            }}
            title={`U+${cp.toString(16).toUpperCase()} — ${h.category}`}
          >
            {shown}
          </span>
        );
      })}
    </>
  );
}

function escapeAsciiControls(text: string): string {
  let out = '';
  for (const ch of text) {
    const cp = ch.codePointAt(0)!;
    const esc = escapeChar(cp);
    out += esc ?? ch;
  }
  return out;
}

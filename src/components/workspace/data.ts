import { useMemo } from 'react';
import { useStore } from '@/store/useAnalysisStore';
import { isGridFileType } from '@/types/analysis';
import type { AnalysisResult, CharFinding, FindingCategory, Severity } from '@/types/analysis';
import { buildUnitIndex, buildCharMap, type UnitIndex, type CharMap } from '@/lib/engine/unit-index';

/** Findings after ignore-list, category, severity and worksheet filters. */
export function useFilteredFindings(result: AnalysisResult): CharFinding[] {
  const ignored = useStore((s) => s.ignoredKeys);
  const filters = useStore((s) => s.filters);
  const activeSheet = useStore((s) => s.activeSheet);

  return useMemo(() => {
    const catSet = new Set<FindingCategory>(filters.categories);
    const q = filters.search.trim().toLowerCase();
    return result.findings.filter((f) => {
      if (ignored.includes(f.key)) return false;
      if (!catSet.has(f.category)) return false;
      if (filters.severity !== 'all' && f.severity !== filters.severity) return false;
      if (isGridFileType(result.fileType) && activeSheet) {
        if (!f.locations.some((l) => l.sheet === activeSheet)) return false;
      }
      if (q) {
        const hay = `${f.name} ${f.char} ${f.key} ${f.description} ${f.codePoint.toString(16)}`;
        if (!hay.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [result, ignored, filters, activeSheet]);
}

/** Findings that pass ignore/category/severity filters (no worksheet/search filter). */
function useVisibleFindings(result: AnalysisResult): CharFinding[] {
  const ignored = useStore((s) => s.ignoredKeys);
  const filters = useStore((s) => s.filters);

  return useMemo(() => {
    const catSet = new Set<FindingCategory>(filters.categories);
    return result.findings.filter(
      (f) =>
        !ignored.includes(f.key) &&
        catSet.has(f.category) &&
        (filters.severity === 'all' || f.severity === filters.severity),
    );
  }, [result, ignored, filters]);
}

/** Unit index used by previews — honours ignore list + category/severity filters. */
export function useVisibleIndex(result: AnalysisResult): UnitIndex {
  const findings = useVisibleFindings(result);
  return useMemo(() => buildUnitIndex({ ...result, findings }), [result, findings]);
}

/**
 * Render-time character map: all visible suspicious code points + mojibake
 * sequences. Previews compare every character against this map to decide
 * highlighting — stored offsets are never trusted for rendering.
 */
export function useCharMap(result: AnalysisResult): CharMap {
  const findings = useVisibleFindings(result);
  return useMemo(() => buildCharMap(findings), [findings]);
}

/** Per-worksheet finding counts (Excel). */
export function useSheetCounts(result: AnalysisResult): Map<string, number> {
  const ignored = useStore((s) => s.ignoredKeys);
  return useMemo(() => {
    const map = new Map<string, number>();
    if (!result.excel) return map;
    for (const s of result.excel.sheets) map.set(s.name, 0);
    for (const f of result.findings) {
      if (ignored.includes(f.key)) continue;
      for (const l of f.locations) {
        if (l.sheet !== undefined) map.set(l.sheet, (map.get(l.sheet) ?? 0) + 1);
      }
    }
    return map;
  }, [result, ignored]);
}

/** Record indices (into csv.records) that contain at least one visible finding. */
export function useCsvRowsWithFindings(index: UnitIndex): Set<number> {
  return useMemo(() => {
    const set = new Set<number>();
    for (const key of index.keys()) {
      if (key.startsWith('R')) {
        const r = parseInt(key.slice(1).split(':')[0], 10);
        if (!Number.isNaN(r)) set.add(r);
      }
    }
    return set;
  }, [index]);
}

export function severityTone(s: Severity): 'sky' | 'yellow' | 'zinc' | 'rose' | 'violet' | 'orange' {
  if (s === 'recommended') return 'yellow';
  if (s === 'review') return 'orange';
  return 'zinc';
}

export const CATEGORY_COLOR: Record<FindingCategory, string> = {
  'non-ascii': 'bg-rose-500',
  whitespace: 'bg-yellow-400',
  invisible: 'bg-violet-500',
  control: 'bg-red-500',
  mojibake: 'bg-orange-500',
  bom: 'bg-sky-400',
};

export const CATEGORY_TEXT: Record<FindingCategory, string> = {
  'non-ascii': 'text-rose-500',
  whitespace: 'text-yellow-500',
  invisible: 'text-violet-500',
  control: 'text-red-500',
  mojibake: 'text-orange-500',
  bom: 'text-sky-400',
};

import type {
  AnalysisResult,
  CharFinding,
  FindingCategory,
  Location,
  Severity,
} from '@/types/analysis';

export interface IndexedHit {
  loc: Location;
  category: FindingCategory;
  severity: Severity;
  findingKey: string;
  char: string;
  isSequence: boolean;
}

export type UnitIndex = Map<string, IndexedHit[]>;

export function lineKey(line: number): string {
  return `L${line}`;
}
export function fieldKey(record: number, fieldIndex: number): string {
  return `R${record}:C${fieldIndex}`;
}
export function cellKey(sheet: string, row: number, col: number): string {
  return `S${sheet}!R${row}:C${col}`;
}

export function unitKeyFor(
  fileType: AnalysisResult['fileType'],
  loc: Location,
): string | null {
  if (fileType === 'text') return loc.line !== undefined ? lineKey(loc.line) : null;
  if (fileType === 'csv') {
    // loc.record is 1-based (header = record 1); preview keys use 0-based indexes.
    return loc.record !== undefined && loc.fieldIndex !== undefined
      ? fieldKey(loc.record - 1, loc.fieldIndex)
      : null;
  }
  if (loc.sheet !== undefined && loc.cellRow !== undefined && loc.cellCol !== undefined) {
    return cellKey(loc.sheet, loc.cellRow, loc.cellCol);
  }
  return null;
}

/**
 * Build a lookup from "unit" (line / CSV field / Excel cell) to the hits it
 * contains, so previews only pay for units that actually contain findings.
 */
export function buildUnitIndex(result: AnalysisResult): UnitIndex {
  const index: UnitIndex = new Map();
  for (const f of result.findings) {
    for (const loc of f.locations) {
      const key = unitKeyFor(result.fileType, loc);
      if (!key) continue;
      const hit: IndexedHit = {
        loc,
        category: f.category,
        severity: f.severity,
        findingKey: f.key,
        char: f.char,
        isSequence: !!f.isSequence,
      };
      const list = index.get(key);
      if (list) list.push(hit);
      else index.set(key, [hit]);
    }
  }
  for (const [, list] of index) {
    list.sort((a, b) => a.loc.utf16Offset - b.loc.utf16Offset);
  }
  return index;
}

/* -------------------- character map (render-time matching) -------------------- */

export interface CharMapEntry {
  findingKey: string;
  category: FindingCategory;
  severity: Severity;
  char: string;
  isSequence: boolean;
}

/**
 * Render-time lookup built from findings:
 * - `single`: code point → entry (non-ascii / whitespace / invisible / control / bom)
 * - `sequences`: mojibake strings, longest first so "ï»¿" wins over "»¿"
 *
 * Previews compare every rendered character against this map — no stored
 * offsets are trusted for highlighting.
 */
export interface CharMap {
  single: Map<number, CharMapEntry>;
  sequences: { text: string; entry: CharMapEntry }[];
}

export function buildCharMap(findings: CharFinding[]): CharMap {
  const single = new Map<number, CharMapEntry>();
  const sequences: { text: string; entry: CharMapEntry }[] = [];
  for (const f of findings) {
    const entry: CharMapEntry = {
      findingKey: f.key,
      category: f.category,
      severity: f.severity,
      char: f.char,
      isSequence: !!f.isSequence,
    };
    if (f.isSequence && f.char.length > 1) {
      sequences.push({ text: f.char, entry });
    } else {
      single.set(f.codePoint, entry);
    }
  }
  sequences.sort((a, b) => b.text.length - a.text.length);
  return { single, sequences };
}

export interface Segment {
  text: string;
  hit?: IndexedHit;
  /** utf16 offset of this segment inside the unit */
  start: number;
}

/**
 * Split a unit string into plain / highlighted segments by comparing each
 * rendered character (and mojibake sequence) against the character map.
 * `hitsByOffset` (optional) supplies exact Location data for click/selection.
 */
export function renderSegments(
  text: string,
  charMap: CharMap,
  hitsByOffset?: Map<number, IndexedHit>,
): Segment[] {
  if (!text) return [];
  const segs: Segment[] = [];
  let cursor = 0; // utf16 cursor
  let plainStart = 0;

  const pushPlain = (end: number) => {
    if (end > plainStart) segs.push({ text: text.slice(plainStart, end), start: plainStart });
  };

  while (cursor < text.length) {
    // 1) try mojibake sequences first (longest match wins)
    let seqMatch: { text: string; entry: CharMapEntry } | null = null;
    for (const s of charMap.sequences) {
      if (s.text.length <= text.length - cursor && text.startsWith(s.text, cursor)) {
        seqMatch = s;
        break;
      }
    }
    if (seqMatch) {
      pushPlain(cursor);
      const len = seqMatch.text.length;
      const known = hitsByOffset?.get(cursor);
      segs.push({
        text: seqMatch.text,
        start: cursor,
        hit: known ?? syntheticHit(cursor, len, seqMatch.entry),
      });
      cursor += len;
      plainStart = cursor;
      continue;
    }

    // 2) single code point lookup
    const cp = text.codePointAt(cursor)!;
    const cpLen = cp > 0xffff ? 2 : 1;
    const entry = charMap.single.get(cp);
    if (entry) {
      pushPlain(cursor);
      const known = hitsByOffset?.get(cursor);
      segs.push({
        text: text.slice(cursor, cursor + cpLen),
        start: cursor,
        hit: known ?? syntheticHit(cursor, cpLen, entry),
      });
      cursor += cpLen;
      plainStart = cursor;
      continue;
    }

    cursor += cpLen;
  }
  pushPlain(text.length);
  return segs;
}

function syntheticHit(utf16Offset: number, length: number, entry: CharMapEntry): IndexedHit {
  return {
    loc: {
      id: `map:${entry.findingKey}:${utf16Offset}`,
      cpOffset: utf16Offset,
      utf16Offset,
      length,
      cpLength: [...entry.char].length,
    },
    category: entry.category,
    severity: entry.severity,
    findingKey: entry.findingKey,
    char: entry.char,
    isSequence: entry.isSequence,
  };
}

/** Escape invisible characters for the "escaped" text view. */
export function escapeChar(cp: number): string | null {
  if (cp === 0x09) return '\\t';
  if (cp === 0x0a) return '\\n';
  if (cp === 0x0d) return '\\r';
  if (cp < 0x20 || cp === 0x7f) return `\\x${cp.toString(16).toUpperCase().padStart(2, '0')}`;
  if (cp >= 0x80 && cp <= 0x9f) return `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`;
  return null;
}

export const HIGHLIGHT_CLASS: Record<FindingCategory, string> = {
  'non-ascii': 'hl-nonascii',
  whitespace: 'hl-whitespace',
  invisible: 'hl-invisible',
  control: 'hl-control',
  mojibake: 'hl-mojibake',
  bom: 'hl-bom',
};

/** Marker used when rendering invisible characters inline. */
export function inlineMarker(h: IndexedHit): string | null {
  const cp = h.char.codePointAt(0)!;
  if (h.category === 'invisible' || h.category === 'control' || h.category === 'bom') {
    if (h.isSequence) return h.char;
    if (cp === 0xfeff) return '␡BOM';
    if (cp === 0x00ad) return '­';
    return `·`;
  }
  return null;
}

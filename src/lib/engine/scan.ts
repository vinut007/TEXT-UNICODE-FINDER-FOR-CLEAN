import {
  classifyCodePoint,
  findMojibake,
  type MojibakeMatch,
} from '@/lib/unicode/classify';
import { getCodePointName, getCategoryCode, getCategoryLabel } from '@/lib/unicode/names';
import type {
  CharFinding,
  FindingCategory,
  Location,
  ScanOptions,
  ScanStats,
  Severity,
} from '@/types/analysis';
import { toCodePointHex } from '@/lib/utils';

const MAX_LOCATIONS = 300;
const PROGRESS_EVERY = 20_000; // code points between progress callbacks

export interface RawHit {
  category: FindingCategory;
  severity: Severity;
  /** Match text (one code point, or a mojibake sequence). */
  text: string;
  /** UTF-16 offset inside the unit. */
  utf16Offset: number;
  /** Code-point offset inside the unit. */
  cpOffset: number;
  cpLength: number;
  length: number;
  suggestion?: { char: string; codePoint?: number; label: string };
  description: string;
  isSequence?: boolean;
}

export type ProgressFn = (scanned: number, findings: number) => void;

/** Build the list of mojibake ranges for a unit (sorted by start). */
function mojibakeIndex(text: string, enabled: boolean): MojibakeMatch[] {
  if (!enabled) return [];
  return findMojibake(text);
}

/**
 * Scan a single text unit (one line, one CSV field, one Excel cell) and
 * invoke `emit` for every suspicious character found.
 * Returns the number of code points visited.
 */
export function scanUnit(
  text: string,
  options: ScanOptions,
  emit: (hit: RawHit) => void,
  onProgress?: ProgressFn,
): number {
  if (text.length === 0) return 0;

  const moji = mojibakeIndex(text, options.mojibake);
  const skipUntil = new Map<number, MojibakeMatch>();
  for (const m of moji) skipUntil.set(m.start, m);

  let cpCount = 0;
  let utf16 = 0;
  let hits = 0;

  while (utf16 < text.length) {
    const pending = skipUntil.get(utf16);
    if (pending) {
      const cpLen = [...pending.text].length;
      emit({
        category: 'mojibake',
        severity: 'review',
        text: pending.text,
        utf16Offset: utf16,
        cpOffset: cpCount,
        cpLength: cpLen,
        length: pending.length,
        isSequence: true,
        suggestion: {
          char: '',
          label: 'Review encoding — likely UTF-8 read as Windows-1252',
        },
        description:
          'This byte sequence decodes to readable text only when the file is interpreted with the wrong encoding (typically UTF-8 bytes read as Windows-1252). Re-decode the original file instead of patching characters blindly.',
      });
      hits++;
      utf16 += pending.length;
      cpCount += cpLen;
      continue;
    }

    const cp = text.codePointAt(utf16)!;
    const raw = cp > 0xffff ? text.slice(utf16, utf16 + 2) : text[utf16];
    cpCount++;
    utf16 += raw.length;

    if (cp < 0x80) {
      // fast ASCII path
      if (cp === 0x09 || cp === 0x0a || cp === 0x0d) {
        if (options.asciiWhitespace && options.unicodeWhitespace) {
          const c = classifyCodePoint(cp, { asciiWhitespace: true });
          if (c.category) {
            emit({
              category: c.category,
              severity: c.severity,
              text: raw,
              utf16Offset: utf16 - raw.length,
              cpOffset: cpCount - 1,
              cpLength: 1,
              length: raw.length,
              suggestion: c.suggestion,
              description: c.description,
            });
            hits++;
          }
        }
      } else if (options.control && cp < 0x20) {
        const c = classifyCodePoint(cp, { asciiWhitespace: options.asciiWhitespace });
        if (c.category) {
          emit({
            category: c.category,
            severity: c.severity,
            text: raw,
            utf16Offset: utf16 - raw.length,
            cpOffset: cpCount - 1,
            cpLength: 1,
            length: raw.length,
            suggestion: c.suggestion,
            description: c.description,
          });
          hits++;
        }
      }
      continue;
    }

    // ---- non-ASCII ----
    const cls = classifyCodePoint(cp, { asciiWhitespace: options.asciiWhitespace });
    if (!cls.category) continue;

    const enabled =
      (cls.category === 'non-ascii' && options.allNonAscii) ||
      (cls.category === 'whitespace' && options.unicodeWhitespace) ||
      (cls.category === 'invisible' && options.invisible) ||
      (cls.category === 'control' && options.control) ||
      cls.category === 'bom';
    if (!enabled) continue;

    emit({
      category: cls.category,
      severity: cls.severity,
      text: raw,
      utf16Offset: utf16 - raw.length,
      cpOffset: cpCount - 1,
      cpLength: 1,
      length: raw.length,
      suggestion: cls.suggestion,
      description: cls.description,
    });
    hits++;
  }

  onProgress?.(cpCount, hits);
  return cpCount;
}

/* ----------------------------- aggregation ----------------------------- */

interface Draft {
  key: string;
  codePoint: number;
  char: string;
  name: string;
  category: FindingCategory;
  count: number;
  severity: Severity;
  suggestion?: { char: string; codePoint?: number; label: string };
  description: string;
  isSequence?: boolean;
  locations: Location[];
  truncated: boolean;
}

export class Aggregator {
  private map = new Map<string, Draft>();

  get size(): number {
    return this.map.size;
  }

  totalCodePoints = 0;
  nonAscii = 0;
  whitespace = 0;
  invisible = 0;
  control = 0;
  mojibake = 0;
  bom = 0;

  add(hit: RawHit, location: Location): void {
    const cp = hit.text.codePointAt(0)!;
    const key = hit.isSequence
      ? `mojibake:${hit.text}`
      : `${hit.category}:${cp.toString(16).toUpperCase().padStart(4, '0')}`;

    let d = this.map.get(key);
    if (!d) {
      const name = hit.isSequence
        ? `MOJIBAKE SEQUENCE “${hit.text}”`
        : getCodePointName(cp);
      d = {
        key,
        codePoint: cp,
        char: hit.text,
        name,
        category: hit.category,
        count: 0,
        severity: hit.severity,
        suggestion: hit.suggestion,
        description: hit.description,
        isSequence: hit.isSequence,
        locations: [],
        truncated: false,
      };
      this.map.set(key, d);
    }
    d.count++;
    const cap = d.severity === 'none' ? 40 : MAX_LOCATIONS;
    if (d.locations.length < cap) d.locations.push(location);
    else d.truncated = true;

    switch (hit.category) {
      case 'non-ascii': this.nonAscii++; break;
      case 'whitespace': this.whitespace++; break;
      case 'invisible': this.invisible++; break;
      case 'control': this.control++; break;
      case 'mojibake': this.mojibake++; break;
      case 'bom': this.bom++; break;
    }
  }

  addCodePoints(n: number): void {
    this.totalCodePoints += n;
  }

  stats(): ScanStats {
    return {
      totalCodePoints: this.totalCodePoints,
      nonAsciiCount: this.nonAscii,
      unicodeWhitespaceCount: this.whitespace,
      invisibleCount: this.invisible,
      controlCount: this.control,
      mojibakeCount: this.mojibake,
      uniqueSuspicious: [...this.map.values()].filter((d) => d.severity !== 'none').length,
      bomCount: this.bom,
    };
  }

  finalize(): CharFinding[] {
    const out: CharFinding[] = [];
    for (const d of this.map.values()) {
      const cp = d.codePoint;
      out.push({
        key: d.key,
        codePoint: cp,
        char: d.char,
        name: d.name,
        category: d.category,
        count: d.count,
        severity: d.severity,
        suggestion: d.suggestion,
        description: d.description,
        isSequence: d.isSequence,
        locations: d.locations,
        locationsTruncated: d.truncated,
      });
    }
    out.sort((a, b) => {
      const sevRank = (s: Severity) => (s === 'recommended' ? 0 : s === 'review' ? 1 : 2);
      const r = sevRank(a.severity) - sevRank(b.severity);
      if (r !== 0) return r;
      if (b.count !== a.count) return b.count - a.count;
      return a.codePoint - b.codePoint;
    });
    return out;
  }
}

/** Context snippet around a hit (sanitized: control chars made visible). */
export function buildContext(unit: string, utf16Offset: number, length: number): string {
  const start = Math.max(0, utf16Offset - 12);
  const end = Math.min(unit.length, utf16Offset + length + 12);
  const raw = unit.slice(start, end);
  return visible(raw);
}

/** Replace control/invisible characters with escape sequences for display. */
export function visible(s: string): string {
  let out = '';
  for (const ch of s) {
    const cp = ch.codePointAt(0)!;
    if (ch === '\n') out += '\\n';
    else if (ch === '\r') out += '\\r';
    else if (ch === '\t') out += '\\t';
    else if (cp < 0x20 || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f)) {
      out += `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`;
    } else if (cp === 0xfeff) out += '\\uFEFF';
    else if (cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0x2060) {
      out += `\\u${cp.toString(16).toUpperCase().padStart(4, '0')}`;
    } else out += ch;
  }
  return out;
}

export function findingLocationSummary(f: CharFinding, fileType: 'csv' | 'text' | 'excel' | 'access'): string {
  const locs = f.locations;
  if (locs.length === 0) return '—';
  const first = locs[0];
  if (fileType === 'text' && first.line !== undefined) {
    if (locs.length === 1) return `Line ${first.line}, col ${first.column ?? 1}`;
    return `Line ${first.line} + ${locs.length - 1}${f.locationsTruncated ? '+' : ''} more`;
  }
  if (fileType === 'csv' && first.record !== undefined) {
    const row = first.dataRow && first.dataRow > 0 ? first.dataRow : first.record;
    const col = first.fieldHeader ?? (first.fieldIndex !== undefined ? `col ${first.fieldIndex + 1}` : '?');
    if (locs.length === 1) return `Row ${row}, ${col}`;
    return `Row ${row}, ${col} + ${locs.length - 1}${f.locationsTruncated ? '+' : ''} more`;
  }
  if ((fileType === 'excel' || fileType === 'access') && first.sheet !== undefined) {
    if (locs.length === 1) return `${first.sheet}!${first.cell}`;
    return `${first.sheet}!${first.cell} + ${locs.length - 1}${f.locationsTruncated ? '+' : ''} more`;
  }
  return '—';
}

export function codePointLabel(cp: number): string {
  return toCodePointHex(cp);
}

export function categoryLabel(c: FindingCategory): string {
  switch (c) {
    case 'non-ascii': return 'Non-ASCII';
    case 'whitespace': return 'Whitespace';
    case 'invisible': return 'Invisible';
    case 'control': return 'Control';
    case 'mojibake': return 'Mojibake';
    case 'bom': return 'Byte Order Mark';
  }
}

export { getCategoryCode, getCategoryLabel };

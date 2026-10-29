import type { AnalysisResult, CharFinding, CleanOp, Location } from '@/types/analysis';
import {
  detectLineEnding,
  makeDoc,
  rebuildDoc,
  serializeCsvData,
  type CleanableDoc,
} from './clean';
import { XLSX } from './excel';
import { baseName, toCodePointHex } from '@/lib/utils';

export interface ExportedFile {
  bytes: Uint8Array | string;
  fileName: string;
  mime: string;
  warnings: string[];
}

/** Build the cleaned document from the original analysis + the op chain. */
export function buildCleanedDoc(
  result: AnalysisResult,
  chain: CleanOp[][],
): { doc: CleanableDoc; count: number } {
  return rebuildDoc(makeDoc(result), chain);
}

/** Serialize a cleaned doc for download (TXT / CSV). */
export function exportCleanedTextOrCsv(result: AnalysisResult, chain: CleanOp[][]): ExportedFile {
  const { doc, count } = buildCleanedDoc(result, chain);
  const originalText = result.text ?? '';
  const eol = detectLineEnding(originalText);

  if (result.fileType === 'csv' && doc.csv) {
    const body = serializeCsvData(doc.csv, eol);
    const ext = result.fileName.toLowerCase().endsWith('.tsv') ? '.tsv' : '.csv';
    return {
      bytes: body,
      fileName: `${stripExt(result.fileName)}-cleaned${ext}`,
      mime: 'text/csv;charset=utf-8',
      warnings: [
        `CSV re-serialized with RFC 4180 quoting and ${eol === '\r\n' ? 'CRLF' : 'LF'} line endings. Applied ${count} replacement${count === 1 ? '' : 's'}.`,
      ],
    };
  }

  const text = doc.text ?? '';
  const ext = extOf(result.fileName) || 'txt';
  return {
    bytes: text,
    fileName: `${stripExt(result.fileName)}-cleaned.${ext}`,
    mime: 'text/plain;charset=utf-8',
    warnings: [`Applied ${count} replacement${count === 1 ? '' : 's'}. Line endings preserved.`],
  };
}

/** Export one code point per row as a UTF-8 CSV file (4 columns). */
export function exportErrorWordsCsv(result: AnalysisResult): ExportedFile {
  const esc = (v: string) => {
    if (/[",\n\r]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
    return v;
  };
  const lines: string[] = [];
  lines.push(
    ['Code Point', 'code point character', 'replace code point', 'replace code point character'].map(esc).join(','),
  );
  for (const f of result.findings) {
    const char = f.isSequence ? f.char : displayChar(f);
    const replaceCp = f.suggestion?.codePoint !== undefined ? toCodePointHex(f.suggestion.codePoint) : '';
    const replaceChar = f.suggestion ? (f.suggestion.char === '' ? '' : f.suggestion.char) : '';
    lines.push([toCodePointHex(f.codePoint), char, replaceCp, replaceChar].map(esc).join(','));
  }
  const body = lines.join('\n') + '\n';
  return {
    bytes: body,
    fileName: `${baseName(result.fileName)}-error-words.csv`,
    mime: 'text/csv;charset=utf-8',
    warnings: [`Exported ${result.findings.length} error code point(s), one per row.`],
  };
}

/** Build a cleaned .xlsx from the original workbook + op chain. */
export async function exportCleanedExcel(
  originalFile: File,
  result: AnalysisResult,
  chain: CleanOp[][],
): Promise<ExportedFile> {
  const buffer = await originalFile.arrayBuffer();
  const wb = XLSX.read(buffer, { type: 'array', cellDates: false, cellFormula: false });

  let replaced = 0;
  let skippedNonText = 0;

  for (const ops of chain) {
    if (ops.length === 0) continue;
    const global = ops.filter((o) => o.scope.unit === 'document');
    const cellScoped = ops.filter((o) => o.scope.unit === 'cell');
    const cellMap = new Map<string, CellRule[]>();
    for (const op of cellScoped) {
      const s = op.scope as { sheet: string; row: number; col: number; atCpOffset?: number };
      const key = `${s.sheet}:${s.row}:${s.col}`;
      const list = cellMap.get(key);
      const rule: CellRule = { from: op.fromText, to: op.to, at: s.atCpOffset };
      if (list) list.push(rule);
      else cellMap.set(key, [rule]);
    }

    for (const name of wb.SheetNames) {
      const ws = wb.Sheets[name];
      if (!ws || !ws['!ref']) continue;
      const range = XLSX.utils.decode_range(ws['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const addr = XLSX.utils.encode_cell({ r: R, c: C });
          const cell = ws[addr];
          if (!cell) continue;
          const rules: CellRule[] = [];
          for (const g of global) rules.push({ from: g.fromText, to: g.to });
          const scoped = cellMap.get(`${name}:${R + 1}:${C + 1}`);
          if (scoped) rules.push(...scoped);
          if (rules.length === 0) continue;

          if (cell.t === 's' && typeof cell.v === 'string') {
            const res = applyRules(cell.v, rules);
            if (res.changed > 0) {
              cell.v = res.out;
              cell.w = undefined;
              replaced += res.changed;
            }
          } else if (cell.w !== undefined) {
            const res = applyRules(String(cell.w), rules);
            if (res.changed > 0) skippedNonText += res.changed;
          }
        }
      }
    }
  }

  const bytes = XLSX.write(wb, {
    type: 'array',
    bookType: 'xlsx',
    compression: true,
  }) as Uint8Array;

  const warnings: string[] = [];
  if (replaced > 0) warnings.push(`Applied ${replaced} replacement${replaced === 1 ? '' : 's'}.`);
  if (skippedNonText > 0) {
    warnings.push(
      `${skippedNonText} match${skippedNonText === 1 ? ' was' : 'es were'} inside formatted number/date cells and left unchanged to preserve cell types.`,
    );
  }
  warnings.push(
    'Workbook features not modeled here (charts, pivot tables, macros, conditional formatting, images) may be dropped by the community-edition writer.',
  );

  return {
    bytes,
    fileName: `${stripExt(result.fileName)}-cleaned.xlsx`,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    warnings,
  };
}

/**
 * Export cleaned Access tables. Browsers cannot write .accdb, so the cleaned
 * data is serialized as an .xlsx workbook (one sheet per table).
 */
export function exportCleanedAccess(
  result: AnalysisResult,
  chain: CleanOp[][],
): ExportedFile {
  const { doc, count } = buildCleanedDoc(result, chain);
  const sheets = doc.excel?.sheets ?? [];

  const wb = XLSX.utils.book_new();
  for (const sh of sheets) {
    const aoa: string[][] = [colHeaderRow(sh), ...sh.rows];
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws['!cols'] = Array.from({ length: sh.colCount }, () => ({ wch: 18 }));
    XLSX.utils.book_append_sheet(wb, ws, sh.name.slice(0, 31) || 'Table');
  }

  const bytes = XLSX.write(wb, {
    type: 'array',
    bookType: 'xlsx',
    compression: true,
  }) as Uint8Array;

  return {
    bytes,
    fileName: `${stripExt(result.fileName)}-cleaned.xlsx`,
    mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    warnings: [
      `Applied ${count} replacement${count === 1 ? '' : 's'} across ${sheets.length} table${sheets.length === 1 ? '' : 's'}.`,
      'Browsers cannot write .accdb files — the cleaned tables were exported as an Excel workbook (.xlsx) with one sheet per table.',
    ],
  };
}

function colHeaderRow(sh: { colCount: number }): string[] {
  const out: string[] = [];
  for (let i = 0; i < sh.colCount; i++) out.push(`Column ${i + 1}`);
  return out;
}

interface CellRule {
  from: string;
  to: string;
  at?: number;
}

function applyRules(value: string, rules: CellRule[]): { out: string; changed: number } {
  if (!value) return { out: value, changed: 0 };
  const byFirst = new Map<string, CellRule[]>();
  for (const r of rules) {
    if (!r.from) continue;
    const k = r.from[0];
    const list = byFirst.get(k);
    if (list) list.push(r);
    else byFirst.set(k, [r]);
  }
  if (byFirst.size === 0) return { out: value, changed: 0 };

  let out = '';
  let changed = 0;
  let i = 0;
  let cp = 0;
  while (i < value.length) {
    const cand = byFirst.get(value[i]);
    let applied = false;
    if (cand) {
      for (const r of cand) {
        if (value.startsWith(r.from, i) && (r.at === undefined || r.at === cp)) {
          out += r.to;
          i += r.from.length;
          cp++;
          changed++;
          applied = true;
          break;
        }
      }
    }
    if (!applied) {
      const c = value.charCodeAt(i);
      out += value[i];
      i++;
      if (c >= 0xd800 && c <= 0xdbff && i < value.length) {
        out += value[i];
        i++;
      }
      cp++;
    }
  }
  return { out, changed };
}

export function displayChar(f: CharFinding): string {
  if (f.isSequence) return f.char;
  const cp = f.codePoint;
  const hex = toCodePointHex(cp).slice(2);
  if (cp === 0x09) return '\\t';
  if (cp === 0x0a) return '\\n';
  if (cp === 0x0d) return '\\r';
  if (cp < 0x20 || cp === 0x7f || (cp >= 0x80 && cp <= 0x9f)) return `\\u${hex}`;
  if (cp === 0xfeff) return '\\uFEFF';
  if (cp === 0x200b || cp === 0x200c || cp === 0x200d || cp === 0x2060 || cp === 0x00ad) {
    return `\\u${hex}`;
  }
  if (
    cp === 0x00a0 || cp === 0x202f || cp === 0x2007 || cp === 0x3000 ||
    (cp >= 0x2000 && cp <= 0x200a) || cp === 0x1680 || cp === 0x205f
  ) {
    return '␣';
  }
  return f.char;
}

export function severityLabel(s: CharFinding['severity']): string {
  if (s === 'recommended') return 'Recommended fix';
  if (s === 'review') return 'Review required';
  return 'No action needed';
}

export function locationSummary(f: CharFinding, fileType: AnalysisResult['fileType']): string {
  const l = f.locations[0];
  if (!l) return '—';
  return locationOf(l, fileType);
}

export function locationOf(l: Location, fileType: AnalysisResult['fileType']): string {
  if (fileType === 'text') return `Line ${l.line ?? '?'}, col ${l.column ?? '?'}`;
  if (fileType === 'csv') {
    const row = l.dataRow && l.dataRow > 0 ? l.dataRow : l.record ?? '?';
    return `Row ${row}, ${l.fieldHeader ?? 'col ' + ((l.fieldIndex ?? 0) + 1)}, pos ${l.fieldCharPos ?? '?'}`;
  }
  return `${l.sheet ?? '?'}!${l.cell ?? '?'}`;
}

function stripExt(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(0, i) : name;
}

function extOf(name: string): string {
  const i = name.lastIndexOf('.');
  return i > 0 ? name.slice(i + 1).toLowerCase() : '';
}

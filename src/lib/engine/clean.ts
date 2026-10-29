import type {
  AnalysisResult,
  CleanOp,
  CleanScope,
  CsvData,
  ExcelData,
  FileType,
} from '@/types/analysis';
import { isGridFileType } from '@/types/analysis';
import { serializeCsv } from './csv';

/** Working copy of the document that cleaning operates on. */
export interface CleanableDoc {
  fileType: FileType;
  /** raw text (txt) — preserved byte-for-byte apart from replacements */
  text?: string;
  /** csv structured records */
  csv?: CsvData;
  /** excel cell grids */
  excel?: ExcelData;
}

interface Rule {
  from: string;
  to: string;
  at?: number;
}

export function makeDoc(result: AnalysisResult): CleanableDoc {
  const doc: CleanableDoc = { fileType: result.fileType };
  if (result.fileType === 'text' || result.fileType === 'csv') doc.text = result.text;
  if (result.fileType === 'csv') doc.csv = result.csv;
  if (isGridFileType(result.fileType)) doc.excel = result.excel;
  return doc;
}

export function cloneDoc(doc: CleanableDoc): CleanableDoc {
  const out: CleanableDoc = { fileType: doc.fileType };
  if (doc.text !== undefined) out.text = doc.text;
  if (doc.csv) {
    out.csv = {
      ...doc.csv,
      headers: [...doc.csv.headers],
      records: doc.csv.records.map((r) => [...r]),
      fieldMeta: doc.csv.fieldMeta,
    };
  }
  if (doc.excel) {
    out.excel = {
      sheets: doc.excel.sheets.map((s) => ({ ...s, rows: s.rows.map((r) => [...r]) })),
    };
  }
  return out;
}

/* --------------------------- unit replacement --------------------------- */

function buildIndex(rules: Rule[]): Map<string, Rule[]> {
  const map = new Map<string, Rule[]>();
  for (const r of rules) {
    if (r.from.length === 0) continue;
    const k = r.from[0];
    const list = map.get(k);
    if (list) list.push(r);
    else map.set(k, [r]);
  }
  return map;
}

/** Apply rules to a single unit; returns new value and replacement count. */
function replaceInUnit(
  unit: string,
  globalIndex: Map<string, Rule[]>,
  localRules: Rule[],
): { out: string; changed: number } {
  if (!unit) return { out: unit, changed: 0 };
  let out = '';
  let changed = 0;
  let i = 0;
  let cp = 0;

  while (i < unit.length) {
    const key = unit[i];
    let applied = false;

    const candidates = globalIndex.get(key);
    if (candidates) {
      for (const r of candidates) {
        if (unit.startsWith(r.from, i) && (r.at === undefined || r.at === cp)) {
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
      for (const r of localRules) {
        if (r.from[0] === key && unit.startsWith(r.from, i) && (r.at === undefined || r.at === cp)) {
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
      const c = unit.charCodeAt(i);
      out += unit[i];
      i++;
      if (c >= 0xd800 && c <= 0xdbff && i < unit.length) {
        out += unit[i];
        i++;
      }
      cp++;
    }
  }
  return { out, changed };
}

function toRule(op: CleanOp): Rule {
  return { from: op.fromText, to: op.to, at: (op.scope as { atCpOffset?: number }).atCpOffset };
}

/** Count how many occurrences an op would replace right now. */
export function countOccurrences(doc: CleanableDoc, op: CleanOp): number {
  return applyOps(doc, [op]).count;
}

export interface ApplyResult {
  doc: CleanableDoc;
  /** total replacements performed */
  count: number;
}

/**
 * Apply cleaning operations to a working copy. The original document is
 * never mutated — always call this on a clone of the original.
 */
export function applyOps(source: CleanableDoc, ops: CleanOp[]): ApplyResult {
  const doc = cloneDoc(source);
  if (ops.length === 0) return { doc, count: 0 };

  const global = ops.filter((o) => o.scope.unit === 'document');
  const local = ops.filter((o) => o.scope.unit !== 'document');
  const globalIndex = buildIndex(global.map(toRule));
  let count = 0;

  if (doc.fileType === 'text' && doc.text !== undefined) {
    // ---- line-scoped ops ----
    const lineRules = new Map<number, Rule[]>();
    for (const op of local) {
      if (op.scope.unit === 'line') {
        const r = toRule(op);
        const list = lineRules.get(op.scope.line);
        if (list) list.push(r);
        else lineRules.set(op.scope.line, [r]);
      }
    }
    if (lineRules.size > 0) {
      const { lines, endings } = splitKeepEndings(doc.text);
      for (const [lineNo, rules] of lineRules) {
        const idx = lineNo - 1;
        if (idx < 0 || idx >= lines.length) continue;
        const res = replaceInUnit(lines[idx], EMPTY_INDEX, rules);
        lines[idx] = res.out;
        count += res.changed;
      }
      doc.text = joinKeepEndings(lines, endings);
    }
    // ---- document-scoped ops ----
    if (globalIndex.size > 0) {
      const res = replaceInUnit(doc.text, globalIndex, []);
      doc.text = res.out;
      count += res.changed;
    }
  } else if (doc.fileType === 'csv' && doc.csv) {
    const csv = doc.csv;
    // local (field-scoped)
    const fieldRules = new Map<string, Rule[]>();
    for (const op of local) {
      if (op.scope.unit !== 'field') continue;
      const key = `${op.scope.record}:${op.scope.fieldIndex}`;
      const r = toRule(op);
      const list = fieldRules.get(key);
      if (list) list.push(r);
      else fieldRules.set(key, [r]);
    }
    for (let r = 0; r < csv.records.length; r++) {
      const row = csv.records[r];
      for (let f = 0; f < row.length; f++) {
        const localRules = fieldRules.get(`${r}:${f}`) ?? EMPTY_RULES;
        const hasGlobal = globalIndex.size > 0;
        if (localRules.length === 0 && !hasGlobal) continue;
        const res = replaceInUnit(row[f], globalIndex, localRules);
        if (res.changed > 0) {
          row[f] = res.out;
          count += res.changed;
        }
      }
    }
  } else if (isGridFileType(doc.fileType) && doc.excel) {
    const cellRules = new Map<string, Rule[]>();
    for (const op of local) {
      if (op.scope.unit !== 'cell') continue;
      const key = `${op.scope.sheet}:${op.scope.row}:${op.scope.col}`;
      const r = toRule(op);
      const list = cellRules.get(key);
      if (list) list.push(r);
      else cellRules.set(key, [r]);
    }
    for (const sh of doc.excel.sheets) {
      const baseRow = sh.startRow;
      const baseCol = sh.startCol;
      for (let r = 0; r < sh.rows.length; r++) {
        const row = sh.rows[r];
        for (let c = 0; c < row.length; c++) {
          if (!row[c]) continue;
          const localRules = cellRules.get(`${sh.name}:${baseRow + r}:${baseCol + c}`) ?? EMPTY_RULES;
          const hasGlobal = globalIndex.size > 0;
          if (localRules.length === 0 && !hasGlobal) continue;
          const res = replaceInUnit(row[c], globalIndex, localRules);
          if (res.changed > 0) {
            row[c] = res.out;
            count += res.changed;
          }
        }
      }
    }
  }

  return { doc, count };
}

const EMPTY_INDEX = new Map<string, Rule[]>();
const EMPTY_RULES: Rule[] = [];

/**
 * Rebuild a document by replaying a chain of operation batches. Batch 0 is
 * applied to the original, batch 1 to the result of batch 0, and so on —
 * this keeps single-occurrence offsets valid across repeated cleaning runs.
 */
export function rebuildDoc(
  source: CleanableDoc,
  chain: CleanOp[][],
): { doc: CleanableDoc; count: number } {
  let doc = cloneDoc(source);
  let total = 0;
  for (const batch of chain) {
    if (!batch.length) continue;
    const res = applyOps(doc, batch);
    doc = res.doc;
    total += res.count;
  }
  return { doc, count: total };
}

/* --------------------------- line preservation -------------------------- */

export function splitKeepEndings(text: string): { lines: string[]; endings: string[] } {
  const lines: string[] = [];
  const endings: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 10) {
      lines.push(text.slice(start, i));
      endings.push('\n');
      start = i + 1;
    } else if (c === 13) {
      if (text.charCodeAt(i + 1) === 10) {
        lines.push(text.slice(start, i));
        endings.push('\r\n');
        i++;
        start = i + 1;
      } else {
        lines.push(text.slice(start, i));
        endings.push('\r');
        start = i + 1;
      }
    }
  }
  lines.push(text.slice(start));
  endings.push('');
  return { lines, endings };
}

export function joinKeepEndings(lines: string[], endings: string[]): string {
  let out = '';
  for (let i = 0; i < lines.length; i++) out += lines[i] + (endings[i] ?? '');
  return out;
}

export function detectLineEnding(text: string): string {
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/\n/g) || []).length - crlf;
  if (crlf >= lf) return '\r\n';
  return '\n';
}

/* ------------------------------ serializing ----------------------------- */

export function serializeCsvData(csv: CsvData, lineEnding = '\r\n'): string {
  const body = serializeCsv(csv.records, csv.delimiter);
  if (lineEnding === '\r\n') return body;
  return body.replace(/\r\n/g, '\n');
}

import type { CsvData, CsvFieldMeta } from '@/types/analysis';

export interface ParseCsvOptions {
  delimiter?: string;
  hasHeader?: boolean;
  /** Abort parsing early (checked every record). */
  shouldCancel?: () => boolean;
  onRecord?: (recordIndex: number) => void;
}

/**
 * CSV / TSV parser with exact position tracking.
 *
 * Handles:
 *  - quoted fields, `""` escaped quotes
 *  - newlines inside quoted fields (logical record ≠ physical line)
 *  - CRLF, LF and lone CR line endings
 *
 * Positions are 1-based. Character positions count Unicode code points;
 * UTF-16 offsets are also provided for rendering.
 */
export function parseCsv(text: string, opts: ParseCsvOptions = {}): CsvData {
  const delimiter = opts.delimiter ?? detectDelimiter(text);
  const n = text.length;

  const recordsRaw: string[][] = [];
  const metaRaw: CsvFieldMeta[][] = [];

  let i = 0;
  let line = 1;
  let lineStart = 0; // UTF-16 offset of current physical line start
  let recordVals: string[] = [];
  let recordMeta: CsvFieldMeta[] = [];
  let recordCount = 0;

  const colAt = (offset: number) => offset - lineStart + 1;

  while (i <= n) {
    if (opts.shouldCancel?.()) break;

    // ---- parse one field ----
    const fieldStartOffset = i;
    const fieldStartLine = line;
    const fieldStartCol = colAt(i);
    let value = '';

    if (text[i] === '"') {
      // quoted field
      i++; // skip opening quote
      let chunkStart = i;
      while (i < n) {
        const ch = text[i];
        if (ch === '"') {
          if (text[i + 1] === '"') {
            value += text.slice(chunkStart, i + 1); // include one quote
            i += 2;
            chunkStart = i;
            continue;
          }
          value += text.slice(chunkStart, i);
          i++; // closing quote
          break;
        }
        if (ch === '\n') {
          value += text.slice(chunkStart, i);
          line++;
          i++;
          lineStart = i;
          chunkStart = i;
          continue;
        }
        if (ch === '\r') {
          value += text.slice(chunkStart, i);
          if (text[i + 1] === '\n') {
            i += 2;
          } else {
            i += 1;
          }
          line++;
          lineStart = i;
          chunkStart = i;
          continue;
        }
        i++;
      }
      if (i > chunkStart && chunkStart <= n) value += text.slice(chunkStart, Math.min(i, n));
      // skip trailing content until delimiter / newline (tolerate malformed rows)
      while (i < n && text[i] !== delimiter && text[i] !== '\n' && text[i] !== '\r') i++;
    } else {
      // unquoted field
      const start = i;
      while (i < n && text[i] !== delimiter && text[i] !== '\n' && text[i] !== '\r') i++;
      value = text.slice(start, i);
    }

    recordVals.push(value);
    recordMeta.push({
      startLine: fieldStartLine,
      startCol: fieldStartCol,
      startOffset: fieldStartOffset,
    });

    // ---- end of field: delimiter or newline or EOF ----
    if (i >= n) {
      recordsRaw.push(recordVals);
      metaRaw.push(recordMeta);
      break;
    }

    if (text[i] === delimiter) {
      i++;
      continue;
    }

    // newline ends the record
    if (text[i] === '\r') {
      i += text[i + 1] === '\n' ? 2 : 1;
      line++;
      lineStart = i;
    } else if (text[i] === '\n') {
      i++;
      line++;
      lineStart = i;
    }

    // skip a single trailing empty line at EOF
    if (i >= n) {
      recordsRaw.push(recordVals);
      metaRaw.push(recordMeta);
      break;
    }

    recordsRaw.push(recordVals);
    metaRaw.push(recordMeta);
    recordCount++;
    opts.onRecord?.(recordCount);
    recordVals = [];
    recordMeta = [];
  }

  if (recordVals.length > 0) {
    recordsRaw.push(recordVals);
    metaRaw.push(recordMeta);
  }

  const hasHeader = opts.hasHeader ?? guessHasHeader(recordsRaw);
  const headers = hasHeader && recordsRaw.length > 0 ? recordsRaw[0] : [];

  return {
    headers,
    records: recordsRaw,
    fieldMeta: metaRaw,
    delimiter,
    hasHeader,
  };
}

/** Sniff the delimiter from a sample of the first lines. */
export function detectDelimiter(text: string): string {
  const sample = text.slice(0, 64 * 1024);
  const candidates = [',', '\t', ';', '|'];
  let best = ',';
  let bestScore = -1;
  for (const d of candidates) {
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < sample.length; i++) {
      const ch = sample[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (!inQuotes && ch === d) count++;
    }
    if (count > bestScore) {
      bestScore = count;
      best = d;
    }
  }
  return best;
}

function guessHasHeader(records: string[][]): boolean {
  if (records.length < 2) return records.length === 1;
  const header = records[0];
  const body = records.slice(1, Math.min(records.length, 25));
  let nonEmpty = 0;
  let numericLike = 0;
  for (const row of body) {
    for (const cell of row) {
      if (cell.trim() !== '') {
        nonEmpty++;
        if (/^[-+]?[\d.,$€£¥%\s]+$/.test(cell) && cell.trim() !== '') numericLike++;
      }
    }
  }
  if (nonEmpty === 0) return true;
  // Header cells are usually non-numeric text.
  const headerNumeric = header.filter((c) => c.trim() !== '' && /^[-+]?[\d.,]+/.test(c)).length;
  const headerNonEmpty = header.filter((c) => c.trim() !== '').length;
  if (headerNonEmpty === 0) return false;
  if (numericLike / nonEmpty > 0.6 && headerNumeric / headerNonEmpty > 0.5) return false;
  return true;
}

/** Serialize records back to CSV text with RFC 4180 quoting. */
export function serializeCsv(records: string[][], delimiter = ','): string {
  const lines: string[] = [];
  for (const row of records) {
    const cells = row.map((raw) => {
      const needs =
        raw.includes('"') ||
        raw.includes(delimiter) ||
        raw.includes('\n') ||
        raw.includes('\r');
      if (needs) return `"${raw.replace(/"/g, '""')}"`;
      return raw;
    });
    lines.push(cells.join(delimiter));
  }
  return lines.join('\r\n');
}

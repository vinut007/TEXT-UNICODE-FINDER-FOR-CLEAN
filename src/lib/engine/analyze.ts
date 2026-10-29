import { decodeText, stripLeadingBom } from './encoding';
import { parseCsv, detectDelimiter } from './csv';
import { readExcel } from './excel';
import { readAccess } from './access';
import { Aggregator, buildContext, scanUnit, type RawHit } from './scan';
import { visible } from './scan';
import type {
  AnalysisResult,
  CharFinding,
  CsvFieldMeta,
  ExcelData,
  FileType,
  Location,
  ScanOptions,
  SheetData,
} from '@/types/analysis';
import { ANALYSIS_STAGES } from '@/types/analysis';

export interface AnalyzeHooks {
  onStage: (stageIndex: number, stageProgress: number, extra?: { scanned?: number; findings?: number; records?: number }) => void;
  shouldCancel: () => boolean;
}

const LARGE_FILE_BYTES = 64 * 1024 * 1024;
// Chunk size used when streaming a large file so we never hold it all in memory.
const STREAM_CHUNK_BYTES = 64 * 1024 * 1024;

export async function analyzeFile(
  file: File | null,
  fileName: string,
  fileSize: number,
  fileType: FileType,
  options: ScanOptions,
  hooks: AnalyzeHooks,
  preloadedExcel?: ExcelData,
  buffer: ArrayBuffer | null = null,
): Promise<AnalysisResult> {
  const t0 = performance.now();
  const warnings: string[] = [];
  const isGrid = fileType === 'excel' || fileType === 'access';

  if (buffer && buffer.byteLength > LARGE_FILE_BYTES) {
    warnings.push(
      'Large file: analysis runs in memory, so your browser may slow down or run out of memory. Consider splitting very large files.',
    );
  }
  if (file && file.size > LARGE_FILE_BYTES) {
    warnings.push(
      'Large file: analysis runs in memory, so your browser may slow down or run out of memory. Consider splitting very large files.',
    );
  }

  const streaming = fileType !== 'excel' && fileType !== 'access'
    && file && file.size > STREAM_CHUNK_BYTES && !buffer;

  /* ---- stage 0: read file ---- */
  hooks.onStage(0, 1);

  /* ---- stage 1: decode + detect format/encoding ---- */
  hooks.onStage(1, 0, { scanned: 0 });

  let text = '';
  let encoding = 'binary';
  let confidence: 'bom' | 'strict' | 'fallback' = 'strict';
  let hasBom = false;
  let formatDetail = '';

  if (!streaming && (fileType === 'text' || fileType === 'csv')) {
    if (!buffer) throw new Error('Missing file content.');
    const decoded = decodeText(buffer);
    let stripped = stripLeadingBom(decoded.text);
    if (stripped.hadBom && decoded.encoding.startsWith('UTF-16')) {
      // leading U+FEFF came from the UTF-16 BOM; keep it stripped
    }
    text = stripped.text;
    encoding = decoded.encoding;
    confidence = decoded.confidence;
    hasBom = decoded.hasBom;
    warnings.push(...decoded.warnings);
    if (stripped.hadBom) hasBom = true;
  } else if (fileType === 'excel') {
    encoding = 'Binary (ZIP/OOXML)';
    confidence = 'strict';
    formatDetail = 'OOXML / OLE2 workbook';
  } else {
    encoding = 'Binary (JET/ACE)';
    confidence = 'strict';
    formatDetail = 'Access database';
  }
  hooks.onStage(1, 1);
  if (hooks.shouldCancel()) throw cancelError();

  const agg = new Aggregator();

  /* ---------- scan by type ---------- */
  let csvData: AnalysisResult['csv'];
  let excelData: AnalysisResult['excel'];
  let lines: string[] | undefined;

  if (streaming && fileType === 'text') {
    const streamed = await scanTextStreaming(file!, options, hooks, agg);
    text = streamed.text;
    encoding = streamed.encoding;
    confidence = streamed.confidence;
    hasBom = streamed.hasBom;
    warnings.push(...streamed.warnings);
    lines = streamed.lines;
    formatDetail = streamed.formatDetail;
  } else if (streaming && fileType === 'csv') {
    const streamed = await scanCsvStreaming(file!, options, hooks, agg);
    csvData = streamed.csv;
    encoding = streamed.encoding;
    confidence = streamed.confidence;
    hasBom = streamed.hasBom;
    warnings.push(...streamed.warnings);
    formatDetail = streamed.formatDetail;
    text = streamed.text;
  } else if (fileType === 'text') {
    formatDetail = guessTextDetail(text);
    hooks.onStage(2, 0, { scanned: 0 });
    lines = splitLines(text);
    const lineStarts = computeLineStarts(lines);
    const total = lines.length;
    let done = 0;
    let scannedInBatch = 0;

    for (let li = 0; li < total; li++) {
      if (hooks.shouldCancel()) throw cancelError();
      const line = lines[li];
      scanUnit(line, options, (hit) => {
        const loc = makeTextLocation(hit, li, lineStarts.cp[li], line);
        agg.add(hit, loc);
      });
      scannedInBatch += line.length;
      done++;
      if (done % 400 === 0 || done === total) {
        agg.addCodePoints(scannedInBatch);
        scannedInBatch = 0;
        hooks.onStage(2, done / total, { scanned: agg.totalCodePoints, findings: agg.size });
      }
    }
    agg.addCodePoints(scannedInBatch);
    hooks.onStage(2, 1, { scanned: agg.totalCodePoints, findings: agg.size });
  } else if (fileType === 'csv') {
    formatDetail = `Delimited text`;
    const delimiter = detectDelimiter(text);
    formatDetail = delimiter === '\t' ? 'Tab-separated (TSV)' : `Delimited text (sep="${visible(delimiter)}")`;

    // parse with position tracking (report under stage 1 → moved to stage 2 start)
    hooks.onStage(2, 0, { scanned: 0, records: 0 });
    const csv = parseCsv(text, {
      delimiter,
      shouldCancel: hooks.shouldCancel,
      onRecord: (count) => {
        if (count % 500 === 0) {
          hooks.onStage(2, 0, { scanned: agg.totalCodePoints, findings: agg.size, records: count });
        }
      },
    });
    if (hooks.shouldCancel()) throw cancelError();
    csvData = csv;
    formatDetail = `${formatDetail} · ${Math.max(0, csv.records.length - (csv.hasHeader ? 1 : 0))} data rows`;

    const totalFields = csv.records.reduce((s, r) => s + r.length, 0);
    let fieldsDone = 0;

    for (let r = 0; r < csv.records.length; r++) {
      if (hooks.shouldCancel()) throw cancelError();
      const row = csv.records[r];
      const metaRow = csv.fieldMeta[r];
      for (let f = 0; f < row.length; f++) {
        const value = row[f];
        if (value.length === 0) continue;
        const meta = metaRow[f];
        scanUnit(value, options, (hit) => {
          const loc = makeCsvLocation(hit, value, r, f, csv.headers, meta);
          agg.add(hit, loc);
        });
        agg.addCodePoints(countCodePoints(value));
      }
      fieldsDone += row.length;
      if ((r + 1) % 200 === 0 || r === csv.records.length - 1) {
        hooks.onStage(2, fieldsDone / Math.max(1, totalFields), {
          scanned: agg.totalCodePoints,
          findings: agg.size,
          records: r + 1,
        });
      }
    }
    hooks.onStage(2, 1, { scanned: agg.totalCodePoints, findings: agg.size });
  } else {
    // Excel workbook OR Access database — both produce SheetData grids.
    hooks.onStage(2, 0, { scanned: 0 });
    let workbook: { sheets: SheetData[]; warnings: string[] };
    if (preloadedExcel) {
      // Re-analysis after cleaning: tables were cleaned in memory.
      workbook = { sheets: preloadedExcel.sheets, warnings: [] };
      hooks.onStage(2, 0.1);
    } else if (fileType === 'access') {
      if (!buffer) throw new Error('Missing file content.');
      workbook = await readAccess(buffer, {
        onProgress: (p) => hooks.onStage(2, p, { scanned: agg.totalCodePoints, findings: agg.size }),
        shouldCancel: hooks.shouldCancel,
      });
    } else {
      if (!buffer) throw new Error('Missing file content.');
      workbook = await readExcel(buffer, {
        onProgress: (p) => hooks.onStage(2, p, { scanned: agg.totalCodePoints, findings: agg.size }),
        shouldCancel: hooks.shouldCancel,
      });
    }
    if (workbook.warnings.length) warnings.push(...workbook.warnings);
    excelData = { sheets: workbook.sheets };
    const totalRows = workbook.sheets.reduce((s, sh) => s + sh.rowCount, 0);
    formatDetail =
      fileType === 'access'
        ? `${workbook.sheets.length} table${workbook.sheets.length === 1 ? '' : 's'} · ${totalRows.toLocaleString()} rows`
        : `${workbook.sheets.length} worksheet${workbook.sheets.length === 1 ? '' : 's'}`;

    let totalCells = 0;
    for (const sh of workbook.sheets) totalCells += sh.rows.reduce((s, r) => s + r.length, 0);
    let cellsDone = 0;

    for (const sh of workbook.sheets) {
      if (hooks.shouldCancel()) throw cancelError();
      const baseRow = sh.startRow;
      const baseCol = sh.startCol;
      for (let r = 0; r < sh.rows.length; r++) {
        if (hooks.shouldCancel()) throw cancelError();
        const row = sh.rows[r];
        for (let c = 0; c < row.length; c++) {
          const value = row[c];
          if (!value) continue;
          const rowNumber = baseRow + r;
          const colNumber = baseCol + c;
          scanUnit(value, options, (hit) => {
            const loc = makeExcelLocation(hit, value, sh.name, rowNumber, colNumber);
            agg.add(hit, loc);
          });
          agg.addCodePoints(countCodePoints(value));
        }
        cellsDone += row.length;
        if ((r + 1) % 100 === 0 || r === sh.rows.length - 1) {
          hooks.onStage(2, cellsDone / Math.max(1, totalCells), {
            scanned: agg.totalCodePoints,
            findings: agg.size,
          });
        }
      }
    }
    hooks.onStage(2, 1, { scanned: agg.totalCodePoints, findings: agg.size });
  }

  if (hooks.shouldCancel()) throw cancelError();

  /* ---- stages 3-5: category passes over collected hits ---- */
  /* ---- stages 3-5: bucket hits per detection category ---- */
  const all = agg.finalize();
  const buckets: Record<string, CharFinding[]> = {
    'non-ascii': [], whitespace: [], invisible: [], control: [], mojibake: [], bom: [],
  };
  for (const f of all) (buckets[f.category] ??= []).push(f);
  hooks.onStage(3, 1, { scanned: agg.totalCodePoints, findings: buckets['non-ascii'].length });
  hooks.onStage(4, 1, {
    findings: buckets.whitespace.length + buckets.invisible.length + buckets.control.length,
  });
  hooks.onStage(5, 1, { findings: buckets.mojibake.length });
  if (hooks.shouldCancel()) throw cancelError();

  /* ---- stage 6: map findings to lines, rows, columns, cells ---- */
  hooks.onStage(6, 0, { findings: all.length });
  if (fileType === 'text' && lines) {
    for (const f of all) {
      for (const loc of f.locations) {
        const line = lines[(loc.line ?? 1) - 1];
        if (line !== undefined) loc.context = buildContext(line, loc.utf16Offset, loc.length);
      }
    }
  }
  hooks.onStage(6, 1, { findings: all.length });

  /* ---- stage 7: prepare results ---- */
  hooks.onStage(7, 0.5);
  const stats = agg.stats();
  const durationMs = performance.now() - t0;
  const result: AnalysisResult = {
    fileName: fileName ?? 'database.accdb',
    fileSize: fileSize ?? (buffer?.byteLength ?? 0),
    fileType,
    encoding,
    encodingConfidence: confidence,
    hasBom,
    formatDetail,
    scannedAt: Date.now(),
    durationMs,
    stats,
    findings: all,
    byteLength: buffer?.byteLength ?? 0,
    warnings,
  };
  if (fileType === 'text') {
    result.text = text;
    result.lines = lines;
  } else if (fileType === 'csv') {
    result.text = text;
    result.csv = csvData;
  } else {
    result.excel = excelData;
  }
  hooks.onStage(7, 1);
  return result;
}

interface StreamTextResult {
  text: string;
  lines: string[];
  encoding: string;
  confidence: 'bom' | 'strict' | 'fallback';
  hasBom: boolean;
  warnings: string[];
  formatDetail: string;
}

function indexOfNewline(s: string, start: number): number {
  for (let i = start; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c === 10 || c === 13) return i;
  }
  return -1;
}

function scanTextLine(
  line: string,
  lineIndex: number,
  lineStartCp: number,
  options: ScanOptions,
  agg: Aggregator,
): void {
  scanUnit(line, options, (hit) => {
    const loc = makeTextLocation(hit, lineIndex, lineStartCp, line);
    agg.add(hit, loc);
  });
}

/** Stream a large text file in chunks so we never hold the whole file in memory. */
async function scanTextStreaming(
  file: File,
  options: ScanOptions,
  hooks: AnalyzeHooks,
  agg: Aggregator,
): Promise<StreamTextResult> {
  const warnings: string[] = [];
  const CHUNK = STREAM_CHUNK_BYTES;

  // Sniff BOM/encoding from the head.
  const head = file.slice(0, 4096);
  const headAb = await head.arrayBuffer();
  const headBytes = new Uint8Array(headAb);

  let decoder: TextDecoder;
  let encoding: string;
  let confidence: 'bom' | 'strict' | 'fallback' = 'strict';
  let hasBom = false;
  let startOffset = 0;

  if (headBytes.length >= 3 && headBytes[0] === 0xef && headBytes[1] === 0xbb && headBytes[2] === 0xbf) {
    decoder = new TextDecoder('utf-8');
    encoding = 'UTF-8 with BOM';
    confidence = 'bom';
    hasBom = true;
    startOffset = 3;
  } else if (headBytes.length >= 2 && headBytes[0] === 0xff && headBytes[1] === 0xfe) {
    decoder = new TextDecoder('utf-16le');
    encoding = 'UTF-16 LE with BOM';
    confidence = 'bom';
    hasBom = true;
    startOffset = 2;
  } else if (headBytes.length >= 2 && headBytes[0] === 0xfe && headBytes[1] === 0xff) {
    decoder = new TextDecoder('utf-16be');
    encoding = 'UTF-16 BE with BOM';
    confidence = 'bom';
    hasBom = true;
    startOffset = 2;
  } else {
    let isUtf8 = true;
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(headBytes);
    } catch {
      isUtf8 = false;
    }
    if (isUtf8) {
      decoder = new TextDecoder('utf-8');
      encoding = 'UTF-8';
    } else {
      decoder = new TextDecoder('windows-1252');
      encoding = 'Windows-1252 (fallback)';
      confidence = 'fallback';
      warnings.push('File is not valid UTF-8. It was decoded as Windows-1252 (best effort).');
    }
  }

  let pending = '';
  let lineIndex = 0;
  let cpOffset = 0;
  let scannedCp = 0;
  let crlf = 0;
  let lf = 0;
  let cr = 0;

  let offset = startOffset;
  while (offset < file.size) {
    if (hooks.shouldCancel()) throw cancelError();
    const end = Math.min(offset + CHUNK, file.size);
    const chunk = file.slice(offset, end);
    const ab = await chunk.arrayBuffer();
    offset = end;
    const decoded = decoder.decode(ab, { stream: offset < file.size });
    const combined = pending + decoded;

    let searchStart = 0;
    for (;;) {
      const nl = indexOfNewline(combined, searchStart);
      if (nl === -1) break;
      const line = combined.slice(searchStart, nl);
      const hasCRLF = combined.charCodeAt(nl) === 13 && combined.charCodeAt(nl + 1) === 10;
      if (hasCRLF) { crlf++; } else if (combined.charCodeAt(nl) === 10) { lf++; } else { cr++; }
      scanTextLine(line, lineIndex, cpOffset, options, agg);
      cpOffset += countCodePoints(line) + 1;
      scannedCp += line.length;
      lineIndex++;
      searchStart = nl + (hasCRLF ? 2 : 1);
      if (hooks.shouldCancel()) throw cancelError();
    }
    pending = combined.slice(searchStart);
    agg.addCodePoints(scannedCp);
    scannedCp = 0;

    hooks.onStage(2, file.size === 0 ? 1 : offset / file.size, {
      scanned: agg.totalCodePoints,
      findings: agg.size,
    });
  }

  if (pending.length > 0) {
    scanTextLine(pending, lineIndex, cpOffset, options, agg);
    lineIndex++;
  }

  let formatDetail = 'Plain text';
  if (crlf > 0 && lf === 0 && cr === 0) formatDetail += ' · CRLF line endings';
  else if (lf > 0 && crlf === 0 && cr === 0) formatDetail += ' · LF line endings';
  else if (cr > 0 && crlf === 0 && lf === 0) formatDetail += ' · CR line endings';
  else if (crlf + lf + cr === 0) formatDetail += ' · no line breaks';
  else formatDetail += ' · mixed line endings';

  return { text: '', lines: [], encoding, confidence, hasBom, warnings, formatDetail };
}

/** Stream a large CSV file in chunks, parsing records incrementally. */
async function scanCsvStreaming(
  file: File,
  options: ScanOptions,
  hooks: AnalyzeHooks,
  agg: Aggregator,
): Promise<{
  text: string;
  csv: AnalysisResult['csv'];
  encoding: string;
  confidence: 'bom' | 'strict' | 'fallback';
  hasBom: boolean;
  warnings: string[];
  formatDetail: string;
}> {
  const warnings: string[] = [];
  const CHUNK = STREAM_CHUNK_BYTES;

  const head = file.slice(0, 4096);
  const headAb = await head.arrayBuffer();
  const headBytes = new Uint8Array(headAb);

  let decoder: TextDecoder;
  let encoding: string;
  let confidence: 'bom' | 'strict' | 'fallback' = 'strict';
  let hasBom = false;
  let startOffset = 0;

  if (headBytes.length >= 3 && headBytes[0] === 0xef && headBytes[1] === 0xbb && headBytes[2] === 0xbf) {
    decoder = new TextDecoder('utf-8');
    encoding = 'UTF-8 with BOM';
    confidence = 'bom';
    hasBom = true;
    startOffset = 3;
  } else if (headBytes.length >= 2 && headBytes[0] === 0xff && headBytes[1] === 0xfe) {
    decoder = new TextDecoder('utf-16le');
    encoding = 'UTF-16 LE with BOM';
    confidence = 'bom';
    hasBom = true;
    startOffset = 2;
  } else if (headBytes.length >= 2 && headBytes[0] === 0xfe && headBytes[1] === 0xff) {
    decoder = new TextDecoder('utf-16be');
    encoding = 'UTF-16 BE with BOM';
    confidence = 'bom';
    hasBom = true;
    startOffset = 2;
  } else {
    let isUtf8 = true;
    try {
      new TextDecoder('utf-8', { fatal: true }).decode(headBytes);
    } catch {
      isUtf8 = false;
    }
    if (isUtf8) {
      decoder = new TextDecoder('utf-8');
      encoding = 'UTF-8';
    } else {
      decoder = new TextDecoder('windows-1252');
      encoding = 'Windows-1252 (fallback)';
      confidence = 'fallback';
      warnings.push('File is not valid UTF-8. It was decoded as Windows-1252 (best effort).');
    }
  }

  const delimiter = await detectDelimiterStreaming(file, decoder, startOffset);
  const headers: string[] = [];
  const records: string[][] = [];
  const fieldMeta: CsvFieldMeta[][] = [];

  let pending = '';
  let recordVals: string[] = [];
  let recordMeta: CsvFieldMeta[] = [];
  let recordCount = 0;
  let line = 1;
  let lineStart = 0;
  let cpOffset = 0;
  let scannedCp = 0;
  let hasHeaderGuessed = false;

  const colAt = (offsetInLine: number) => offsetInLine - lineStart + 1;

  /** Store a finalized record and scan its fields immediately (single pass). */
  const storeRecord = (vals: string[], meta: CsvFieldMeta[]) => {
    const idx = records.length;
    records.push(vals);
    fieldMeta.push(meta);
    if (idx === 0) {
      // First record is treated as the header row; capture its values so later
      // records get real column names in fieldHeader.
      headers.push(...vals);
    }
    if (hooks.shouldCancel()) return;
    for (let f = 0; f < vals.length; f++) {
      const value = vals[f];
      if (value.length === 0) continue;
      const m = meta[f];
      const cp = scanUnit(value, options, (hit) => {
        const loc = makeCsvLocation(hit, value, idx, f, headers, m);
        agg.add(hit, loc);
      });
      agg.addCodePoints(cp);
    }
  };

  let fileOffset = startOffset;
  while (fileOffset < file.size) {
    if (hooks.shouldCancel()) throw cancelError();
    const end = Math.min(fileOffset + CHUNK, file.size);
    const chunk = file.slice(fileOffset, end);
    const ab = await chunk.arrayBuffer();
    fileOffset = end;
    const decoded = decoder.decode(ab, { stream: fileOffset < file.size });
    const combined = pending + decoded;

    let i = 0;
    const n = combined.length;
    let pendingField: string | null = null;
    let pendingFieldMeta: CsvFieldMeta | null = null;

    while (i <= n) {
      if (hooks.shouldCancel()) throw cancelError();
      const fieldStartOffset = i;
      const fieldStartLine = line;
      const fieldStartCol = colAt(i);
      let value = pendingField ?? '';
      pendingField = null;
      const fieldMetaStart = pendingFieldMeta ?? {
        startLine: fieldStartLine,
        startCol: fieldStartCol,
        startOffset: fieldStartOffset,
      };
      pendingFieldMeta = null;

      if (combined[i] === '"') {
        // ---- quoted field ----
        i++; // skip opening quote
        let chunkStart = i;
        let closed = false;
        while (i < n) {
          const ch = combined[i];
          if (ch === '"') {
            if (combined[i + 1] === '"') {
              value += combined.slice(chunkStart, i + 1);
              i += 2;
              chunkStart = i;
              continue;
            }
            value += combined.slice(chunkStart, i);
            i++; // closing quote
            closed = true;
            break;
          }
          if (ch === '\n') {
            value += combined.slice(chunkStart, i);
            line++;
            lineStart = i + 1;
            i++;
            chunkStart = i;
            continue;
          }
          if (ch === '\r') {
            value += combined.slice(chunkStart, i);
            if (combined[i + 1] === '\n') { i += 2; } else { i += 1; }
            line++;
            lineStart = i;
            chunkStart = i;
            continue;
          }
          i++;
        }
        if (!closed && i >= n && fileOffset < file.size) {
          // quoted field continues in the next chunk
          value += combined.slice(chunkStart, n);
          pendingField = value;
          pendingFieldMeta = fieldMetaStart;
          pending = "";
          i = n;
          break;
        }
        if (i > chunkStart && chunkStart <= n) value += combined.slice(chunkStart, Math.min(i, n));
        while (i < n && combined[i] !== delimiter && combined[i] !== '\n' && combined[i] !== '\r') i++;
      } else {
        // ---- unquoted field ----
        const start = i;
        while (i < n && combined[i] !== delimiter && combined[i] !== '\n' && combined[i] !== '\r') i++;
        value = combined.slice(start, i);
      }

      recordVals.push(value);
      recordMeta.push(fieldMetaStart);

      // ---- terminator ----
      if (combined[i] === delimiter) {
        i++;
        continue;
      }

      if (combined[i] === '\r') {
        i += combined[i + 1] === '\n' ? 2 : 1;
        line++;
        lineStart = i;
        storeRecord(recordVals, recordMeta);
        recordCount++;
        recordVals = [];
        recordMeta = [];
        hooks.onStage(2, 0, { scanned: agg.totalCodePoints, findings: agg.size, records: recordCount });
        if (i >= n) {
          if (fileOffset < file.size) { pending = ""; i = n; break; }
          break;
        }
        continue;
      }

      if (combined[i] === '\n') {
        i++;
        line++;
        lineStart = i;
        storeRecord(recordVals, recordMeta);
        recordCount++;
        recordVals = [];
        recordMeta = [];
        hooks.onStage(2, 0, { scanned: agg.totalCodePoints, findings: agg.size, records: recordCount });
        if (i >= n) {
          if (fileOffset < file.size) { pending = ""; i = n; break; }
          break;
        }
        continue;
      }

      // i >= n — field unterminated, more data follows in the next chunk
      if (fileOffset < file.size) {
        pendingField = value;
        pendingFieldMeta = fieldMetaStart;
        pending = "";
        i = n;
        break;
      }

      // end of file
      storeRecord(recordVals, recordMeta);
      recordCount++;
      recordVals = [];
      recordMeta = [];
      break;
    }

    if (i >= n && fileOffset >= file.size) break;
    pending = combined.slice(i);
    scannedCp = 0;
    hooks.onStage(2, file.size === 0 ? 1 : fileOffset / file.size, {
      scanned: agg.totalCodePoints,
      findings: agg.size,
      records: recordCount,
    });
  }

  if (recordVals.length > 0) {
    storeRecord(recordVals, recordMeta);
  }

  const dataRows = records.length > 0 ? records.slice(1) : records;
  const hasHeader = records.length > 0;

  const formatDetail = `Delimited text · ${dataRows.length.toLocaleString()} data rows`;
  return {
    text: '',
    csv: { headers, records, fieldMeta, delimiter, hasHeader },
    encoding,
    confidence,
    hasBom,
    warnings,
    formatDetail,
  };
}

/** Detect delimiter from the head of a streaming file. */
async function detectDelimiterStreaming(
  file: File,
  decoder: TextDecoder,
  startOffset: number,
): Promise<string> {
  const head = file.slice(startOffset, Math.min(file.size, startOffset + 64 * 1024));
  const ab = await head.arrayBuffer();
  const text = decoder.decode(ab);
  return detectDelimiter(text);
}

function cancelError(): Error {
  const e = new Error('cancelled');
  e.name = 'CancelledError';
  return e;
}

function countCodePoints(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c >= 0xd800 && c <= 0xdbff && i + 1 < s.length) i++;
    n++;
  }
  return n;
}

/* ---------------------------- line utilities ---------------------------- */

export function splitLines(text: string): string[] {
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < text.length; i++) {
    const c = text.charCodeAt(i);
    if (c === 10) {
      out.push(text.slice(start, i));
      start = i + 1;
    } else if (c === 13) {
      if (text.charCodeAt(i + 1) === 10) {
        out.push(text.slice(start, i));
        i++;
        start = i + 1;
      } else {
        out.push(text.slice(start, i));
        start = i + 1;
      }
    }
  }
  out.push(text.slice(start));
  return out;
}

export function computeLineStarts(lines: string[]): { utf16: number[]; cp: number[] } {
  const utf16: number[] = [];
  const cp: number[] = [];
  let u = 0;
  let c = 0;
  for (const line of lines) {
    utf16.push(u);
    cp.push(c);
    u += line.length;
    c += countCodePoints(line);
    u += 1; // newline (approximation: handles \n and \r\n as 1 logical break for cp counting)
    c += 1;
  }
  return { utf16, cp };
}

function guessTextDetail(text: string): string {
  const crlf = (text.match(/\r\n/g) || []).length;
  const lf = (text.match(/(?<!\r)\n/g) || []).length;
  const cr = (text.match(/\r(?!\n)/g) || []).length;
  if (crlf > 0 && lf === 0 && cr === 0) return 'Plain text · CRLF line endings';
  if (lf > 0 && crlf === 0 && cr === 0) return 'Plain text · LF line endings';
  if (cr > 0 && crlf === 0 && lf === 0) return 'Plain text · CR line endings';
  if (crlf + lf + cr === 0) return 'Plain text · no line breaks';
  return 'Plain text · mixed line endings';
}

/* ----------------------------- locations ----------------------------- */

function contextOf(unit: string, hit: RawHit): string {
  return buildContext(unit, hit.utf16Offset, hit.length);
}

function makeTextLocation(hit: RawHit, lineIndex: number, lineStartCp: number, line: string): Location {
  return {
    id: `t:${lineIndex}:${hit.cpOffset}:${hit.text}`,
    cpOffset: hit.cpOffset,
    utf16Offset: hit.utf16Offset,
    length: hit.length,
    cpLength: hit.cpLength,
    line: lineIndex + 1,
    column: hit.cpOffset + 1,
    filePos: lineStartCp + hit.cpOffset + 1,
    context: buildContext(line, hit.utf16Offset, hit.length),
  };
}

function makeCsvLocation(
  hit: RawHit,
  value: string,
  recordIndex: number,
  fieldIndex: number,
  headers: string[],
  meta: { startLine: number; startCol: number; startOffset: number },
): Location {
  const before = value.slice(0, hit.utf16Offset);
  let newlines = 0;
  let lastNl = -1;
  for (let i = 0; i < before.length; i++) {
    const c = before.charCodeAt(i);
    if (c === 10) {
      newlines++;
      lastNl = i;
    } else if (c === 13) {
      if (before.charCodeAt(i + 1) === 10) continue;
      newlines++;
      lastNl = i;
    }
  }
  const line = meta.startLine + newlines;
  let column: number;
  if (newlines === 0) column = meta.startCol + hit.cpOffset;
  else {
    column = countCodePoints(before.slice(lastNl + 1)) + 1;
  }
  return {
    id: `c:${recordIndex}:${fieldIndex}:${hit.cpOffset}:${hit.text}`,
    cpOffset: hit.cpOffset,
    utf16Offset: hit.utf16Offset,
    length: hit.length,
    cpLength: hit.cpLength,
    record: recordIndex + 1,
    dataRow: recordIndex + 1 - (headers.length > 0 ? 1 : 0),
    fieldIndex,
    fieldHeader: headers[fieldIndex] ?? `Column ${fieldIndex + 1}`,
    fieldCharPos: hit.cpOffset + 1,
    physicalLine: meta.startLine,
    line,
    column,
    context: contextOf(value, hit),
  };
}

function makeExcelLocation(
  hit: RawHit,
  value: string,
  sheet: string,
  row: number,
  col: number,
): Location {
  return {
    id: `x:${sheet}:${row}:${col}:${hit.cpOffset}:${hit.text}`,
    cpOffset: hit.cpOffset,
    utf16Offset: hit.utf16Offset,
    length: hit.length,
    cpLength: hit.cpLength,
    sheet,
    cell: `${colToLetter(col)}${row}`,
    cellRow: row,
    cellCol: col,
    fieldCharPos: hit.cpOffset + 1,
    context: contextOf(value, hit),
  };
}

function colToLetter(col: number): string {
  let n = col;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export { ANALYSIS_STAGES };

export type FileType = 'csv' | 'excel' | 'text' | 'access';

/** True when the file is scanned as a cell grid (Excel workbook or Access table). */
export function isGridFileType(t: FileType): boolean {
  return t === 'excel' || t === 'access';
}

export type FindingCategory =
  | 'non-ascii'
  | 'whitespace'
  | 'invisible'
  | 'control'
  | 'mojibake'
  | 'bom';

export type Severity = 'recommended' | 'review' | 'none';

/** One concrete occurrence of a suspicious character. */
export interface Location {
  id: string;
  /** 1-based offset in Unicode code points inside the scanned unit (line/field/cell). */
  cpOffset: number;
  /** UTF-16 code-unit offset inside the scanned unit (used for rendering). */
  utf16Offset: number;
  /** Length of the match in UTF-16 code units. */
  length: number;
  /** Length of the match in Unicode code points. */
  cpLength: number;
  /** Free-text snippet around the match (already sanitized before display). */
  context?: string;

  /* ---- TXT ---- */
  line?: number;
  column?: number;
  /** 1-based code-point offset inside the whole file. */
  filePos?: number;

  /* ---- CSV ---- */
  /** 1-based logical record number (header = record 1). */
  record?: number;
  /** 1-based data row number (header excluded). */
  dataRow?: number;
  fieldIndex?: number;
  fieldHeader?: string;
  /** 1-based code-point position inside the field value. */
  fieldCharPos?: number;
  /** 1-based physical line in the raw file where the field content starts. */
  physicalLine?: number;

  /* ---- Excel ---- */
  sheet?: string;
  cell?: string;
  cellRow?: number;
  cellCol?: number;
}

export interface ReplacementSuggestion {
  /** Replacement string, empty string = remove. */
  char: string;
  codePoint?: number;
  label: string;
}

/** Aggregated finding for one kind of character. */
export interface CharFinding {
  /** Stable aggregation key, e.g. "whitespace:00A0" or "mojibake:Ã©". */
  key: string;
  /** Primary code point (first code point for multi-char matches). */
  codePoint: number;
  /** Display string — may span multiple code points for mojibake sequences. */
  char: string;
  name: string;
  category: FindingCategory;
  count: number;
  severity: Severity;
  suggestion?: ReplacementSuggestion;
  description: string;
  /** True when the finding matches more than one code point (mojibake). */
  isSequence?: boolean;
  locations: Location[];
  locationsTruncated: boolean;
}

export interface ScanOptions {
  allNonAscii: boolean;
  unicodeWhitespace: boolean;
  invisible: boolean;
  control: boolean;
  mojibake: boolean;
  /** Include ASCII TAB / LF / CR as whitespace findings (off by default). */
  asciiWhitespace: boolean;
}

export const DEFAULT_SCAN_OPTIONS: ScanOptions = {
  allNonAscii: true,
  unicodeWhitespace: true,
  invisible: true,
  control: true,
  mojibake: true,
  asciiWhitespace: false,
};

export interface CsvFieldMeta {
  /** 1-based physical line where field content starts. */
  startLine: number;
  /** 1-based column inside that line where field content starts. */
  startCol: number;
  /** UTF-16 offset in the raw text where field content starts. */
  startOffset: number;
}

export interface CsvData {
  headers: string[];
  /** records[0] is the header row; every entry is the list of field values. */
  records: string[][];
  /** fieldMeta[recordIndex][fieldIndex] */
  fieldMeta: CsvFieldMeta[][];
  delimiter: string;
  hasHeader: boolean;
}

export interface SheetData {
  name: string;
  /** 2D array of stringified cell values (empty string = empty cell). */
  rows: string[][];
  rowCount: number;
  colCount: number;
  /** 1-based row/column of the top-left cell of the used range. */
  startRow: number;
  startCol: number;
}

export interface ExcelData {
  sheets: SheetData[];
}

export interface ScanStats {
  totalCodePoints: number;
  nonAsciiCount: number;
  unicodeWhitespaceCount: number;
  invisibleCount: number;
  controlCount: number;
  mojibakeCount: number;
  uniqueSuspicious: number;
  bomCount: number;
}

export interface AnalysisResult {
  fileName: string;
  fileSize: number;
  fileType: FileType;
  encoding: string;
  encodingConfidence: 'bom' | 'strict' | 'fallback';
  hasBom: boolean;
  /** MIME-sniffed / extension derived format detail. */
  formatDetail: string;
  scannedAt: number;
  durationMs: number;
  stats: ScanStats;
  findings: CharFinding[];

  /* payload — exactly one populated depending on fileType */
  text?: string;
  lines?: string[];
  csv?: CsvData;
  excel?: ExcelData;

  /** Byte length of the original file as read. */
  byteLength: number;
  /** Warnings (size limits, fallback decoding, workbook feature loss …). */
  warnings: string[];
}

export type SeverityFilter = 'all' | 'recommended' | 'review' | 'none';

/* ---------------- cleaning ---------------- */

export type CleanScope =
  | { unit: 'document' }
  | { unit: 'line'; line: number; atCpOffset?: number }
  | { unit: 'field'; record: number; fieldIndex: number; atCpOffset?: number }
  | { unit: 'cell'; sheet: string; row: number; col: number; atCpOffset?: number };

export interface CleanOp {
  id: string;
  /** 'document' scope replaces everywhere; other scopes target one unit. */
  kind: 'replace-char';
  /** Aggregation key of the finding this op came from. */
  findingKey: string;
  /** Code point to replace (for sequences, the primary code point). */
  from: number;
  /** Match string (for multi-code-point matches such as mojibake). */
  fromText: string;
  /** Replacement string; '' means remove. */
  to: string;
  /** Display label, e.g. "U+00A0 → U+0020". */
  label: string;
  category: FindingCategory;
  /** Affected occurrences computed against the current document. */
  count: number;
  scope: CleanScope;
}

export interface CleanState {
  /** Ops applied to the original document, in order. */
  ops: CleanOp[];
  history: CleanOp[][];
  historyIndex: number;
}

/* ---------------- worker protocol ---------------- */

export interface AnalyzeRequest {
  type: 'analyze';
  /** Source file (used for streaming chunked reads on large files). Posted by
   * structured clone — Blob data is shared, not copied. */
  file?: File | null;
  /** Pre-read ArrayBuffer (transferred, zero-copy) for small files. Mutually
   * exclusive with streaming `file`. */
  buffer?: ArrayBuffer | null;
  fileName: string;
  fileSize: number;
  fileType: FileType;
  options: ScanOptions;
  /**
   * Pre-parsed cell grid (used when re-analyzing a cleaned Access database —
   * browsers cannot write .accdb, so the cleaned tables are passed directly).
   */
  preloadedExcel?: ExcelData;
}

export interface CancelRequest {
  type: 'cancel';
}

export type WorkerRequest = AnalyzeRequest | CancelRequest;

export interface WorkerProgress {
  type: 'progress';
  stageIndex: number;
  stageLabel: string;
  /** Completion of the current stage, 0..1 */
  stageProgress: number;
  /** Overall completion across all stages, 0..1 */
  overall: number;
  scanned: number;
  findings: number;
  records?: number;
}

export type WorkerResponse =
  | WorkerProgress
  | { type: 'done'; result: AnalysisResult }
  | { type: 'error'; message: string }
  | { type: 'cancelled' };

export const ANALYSIS_STAGES = [
  'Reading file',
  'Detecting file format and encoding clues',
  'Scanning Unicode characters',
  'Finding non-ASCII characters',
  'Detecting invisible whitespace',
  'Checking suspicious mojibake patterns',
  'Mapping findings to lines, rows, columns, and cells',
  'Preparing the results',
] as const;

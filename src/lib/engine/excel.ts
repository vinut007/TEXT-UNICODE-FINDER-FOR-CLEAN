import * as XLSX from 'xlsx';
import type { SheetData } from '@/types/analysis';

export interface ExcelReadResult {
  sheets: SheetData[];
  warnings: string[];
}

export interface ExcelReadHooks {
  onProgress: (p: number) => void;
  shouldCancel: () => boolean;
}

const MAX_CELLS_PER_SHEET = 2_000_000;
const MAX_SHEETS = 50;

/**
 * Read a workbook with SheetJS Community Edition and produce plain string
 * grids. Display-formatted text is used so findings match what users see.
 */
export async function readExcel(
  buffer: ArrayBuffer,
  hooks: ExcelReadHooks,
): Promise<ExcelReadResult> {
  const warnings: string[] = [];

  const wb = XLSX.read(buffer, {
    type: 'array',
    cellDates: false,
    cellText: true,
    cellFormula: false,
    cellNF: false,
    cellHTML: false,
    sheetStubs: false,
  });

  if (hooks.shouldCancel()) throw new Error('cancelled');
  hooks.onProgress(0.05);

  const names = wb.SheetNames.slice(0, MAX_SHEETS);
  if (wb.SheetNames.length > MAX_SHEETS) {
    warnings.push(`Workbook has ${wb.SheetNames.length} sheets; only the first ${MAX_SHEETS} were analyzed.`);
  }

  const sheets: SheetData[] = [];
  for (let si = 0; si < names.length; si++) {
    if (hooks.shouldCancel()) throw new Error('cancelled');
    const name = names[si];
    const ws = wb.Sheets[name];
    if (!ws || !ws['!ref']) {
      sheets.push({ name, rows: [], rowCount: 0, colCount: 0, startRow: 1, startCol: 1 });
      continue;
    }

    const range = XLSX.utils.decode_range(ws['!ref']);
    const rowCount = range.e.r - range.s.r + 1;
    const colCount = range.e.c - range.s.c + 1;
    if (rowCount * colCount > MAX_CELLS_PER_SHEET) {
      warnings.push(
        `Sheet "${name}" spans ${rowCount * colCount} cells — very large sheets can exhaust browser memory. Results may be partial.`,
      );
    }

    const grid = XLSX.utils.sheet_to_json<string[]>(ws, {
      header: 1,
      raw: false,
      defval: '',
      blankrows: true,
      range,
    });

    const rows: string[][] = [];
    for (let r = 0; r < rowCount; r++) {
      const src = grid[r] ?? [];
      const row: string[] = [];
      for (let c = 0; c < colCount; c++) {
        const v = src[c];
        if (v === null || v === undefined) row.push('');
        else if (typeof v === 'string') row.push(v);
        else if (typeof v === 'number') row.push(String(v));
        else if (typeof v === 'boolean') row.push(v ? 'TRUE' : 'FALSE');
        else row.push(String(v));
      }
      rows.push(row);
    }

    sheets.push({
      name,
      rows,
      rowCount,
      colCount,
      startRow: range.s.r + 1,
      startCol: range.s.c + 1,
    });
    hooks.onProgress(0.05 + (0.9 * (si + 1)) / names.length);
  }

  return { sheets, warnings };
}

/** Read a workbook from a File/ArrayBuffer (used by the export path). */
export function readWorkbook(buffer: ArrayBuffer): XLSX.WorkBook {
  return XLSX.read(buffer, { type: 'array', cellDates: false, cellFormula: false });
}

export { XLSX };

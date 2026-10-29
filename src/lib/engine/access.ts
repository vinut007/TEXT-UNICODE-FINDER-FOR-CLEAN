import { Buffer } from '@/lib/buffer-polyfill';
import type { SheetData } from '@/types/analysis';

// Lazy-load mdb-reader so the worker bundle never evaluates the
// cipher-base → stream-browserify chain unless an Access file is opened.
// Eager import crashes the whole worker (all file types) in some browsers.
type MDBReaderCtor = new (buffer: Buffer) => {
  getTableNames(): string[];
  getTable(name: string): {
    getColumnNames(): string[];
    rowCount: number;
    getData(opts: { rowOffset: number; rowLimit: number }): Record<string, unknown>[];
  };
};
let MDBReaderClass: MDBReaderCtor | null = null;
async function loadMDBReader(): Promise<MDBReaderCtor> {
  if (!MDBReaderClass) {
    const mod = await import('mdb-reader');
    MDBReaderClass = mod.default as unknown as MDBReaderCtor;
  }
  return MDBReaderClass;
}

export interface AccessReadResult {
  sheets: SheetData[];
  warnings: string[];
}

export interface AccessReadHooks {
  onProgress: (p: number) => void;
  shouldCancel: () => boolean;
}

const MAX_TABLES = 50;
const BATCH_ROWS = 25_000;
const MAX_CELLS_PER_TABLE = 5_000_000;

/**
 * Read an Access database (.mdb / .accdb) and produce the same SheetData grid
 * used for Excel, so highlighting, cleaning and the virtualized preview all
 * work unchanged. Tables are read in batches so multi-million-row tables
 * don't freeze the worker and progress can be reported.
 */
export async function readAccess(
  buffer: ArrayBuffer,
  hooks: AccessReadHooks,
): Promise<AccessReadResult> {
  try {
    return await readAccessInner(buffer, hooks);
  } catch (err) {
    // Never let a raw mdb-reader TypeError escape — wrap with context.
    if (err instanceof Error && err.message === 'cancelled') throw err;
    const detail = err instanceof Error ? err.message : String(err);
    // Full stack goes to the worker console for debugging; UI gets a short message.
    // eslint-disable-next-line no-console
    console.error('[readAccess]', err);
    throw new Error(
      `Could not read Access database: ${detail}. ` +
        'Supported: Access 97–2019 (.mdb / .accdb). Password-protected, encrypted, or corrupt files cannot be read.',
    );
  }
}

async function readAccessInner(
  buffer: ArrayBuffer,
  hooks: AccessReadHooks,
): Promise<AccessReadResult> {
  const warnings: string[] = [];

  const MDBReader = await loadMDBReader();
  let reader: InstanceType<MDBReaderCtor>;
  let tableNames: string[];
  try {
    // Build a polyfill Buffer that owns its bytes. Using alloc+set (not
    // Buffer.from(uint8Array)) avoids view/aliasing edge cases in the browser
    // buffer package that can make mdb-reader's slice/copy see undefined data.
    const bytes = new Uint8Array(buffer);
    const buf = Buffer.alloc(bytes.length);
    buf.set(bytes);
    // Sanity check before handing to mdb-reader.
    if (buf.length === 0) throw new Error('file is empty');
    reader = new MDBReader(buf);
    // getTableNames reads MSysObjects — include it in the same try so any
    // parse failure surfaces as a clean "could not open" error.
    tableNames = reader.getTableNames();
  } catch (err) {
    const detail = err instanceof Error ? err.message : 'unknown format error';
    throw new Error(
      `Could not open Access database: ${detail}. ` +
        'Supported: Access 97–2019 (.mdb / .accdb). Password-protected, encrypted, or corrupt files cannot be read.',
    );
  }

  if (hooks.shouldCancel()) throw new Error('cancelled');
  hooks.onProgress(0.02);

  const names = tableNames.slice(0, MAX_TABLES);
  const totalNames = tableNames.length;
  if (totalNames > MAX_TABLES) {
    warnings.push(`Database has ${totalNames} tables; only the first ${MAX_TABLES} were analyzed.`);
  }

  const sheets: SheetData[] = [];
  for (let ti = 0; ti < names.length; ti++) {
    if (hooks.shouldCancel()) throw new Error('cancelled');
    const name = names[ti];

    let table;
    try {
      table = reader.getTable(name);
    } catch {
      warnings.push(`Table "${name}" could not be read and was skipped.`);
      sheets.push({ name, rows: [], rowCount: 0, colCount: 0, startRow: 1, startCol: 1 });
      continue;
    }

    const colNames = table.getColumnNames();
    const rowCount = table.rowCount;
    const colCount = colNames.length;

    if (rowCount === 0 || colCount === 0) {
      sheets.push({ name, rows: [], rowCount: 0, colCount, startRow: 1, startCol: 1 });
      continue;
    }

    if (rowCount * colCount > MAX_CELLS_PER_TABLE) {
      warnings.push(
        `Table "${name}" has ${rowCount.toLocaleString()} rows × ${colCount} columns — very large tables can exhaust browser memory.`,
      );
    }

    // Batched read keeps the worker responsive and reports progress.
    const rows: string[][] = [];
    let offset = 0;
    while (offset < rowCount) {
      if (hooks.shouldCancel()) throw new Error('cancelled');
      const limit = Math.min(BATCH_ROWS, rowCount - offset);
      let batch: Record<string, unknown>[];
      try {
        batch = table.getData({ rowOffset: offset, rowLimit: limit });
      } catch (err) {
        warnings.push(
          `Table "${name}": read stopped at row ${(offset + 1).toLocaleString()} (${err instanceof Error ? err.message : 'read error'}).`,
        );
        break;
      }
      for (const record of batch) {
        const row = new Array<string>(colCount);
        for (let c = 0; c < colCount; c++) {
          row[c] = stringifyValue(record[colNames[c]]);
        }
        rows.push(row);
      }
      offset += batch.length;
      const tableFrac = offset / rowCount;
      const overall = (ti + tableFrac) / names.length;
      hooks.onProgress(Math.min(0.98, overall));
      if (batch.length < limit) break; // short read = end of data
    }

    sheets.push({
      name,
      rows,
      rowCount: rows.length,
      colCount,
      startRow: 1, // Access tables have no offset — row 1 is the first record
      startCol: 1,
    });
  }

  hooks.onProgress(1);
  return { sheets, warnings };
}

/** Convert an Access cell value to the display string used everywhere else. */
function stringifyValue(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v;
  if (typeof v === 'number' || typeof v === 'boolean' || typeof v === 'bigint') {
    return String(v);
  }
  if (v instanceof Date) return v.toISOString().slice(0, 19).replace('T', ' ');
  if (ArrayBuffer.isView(v)) return `[${v.byteLength} bytes]`;
  if (v instanceof ArrayBuffer) return `[${v.byteLength} bytes]`;
  // Attachment arrays and other complex values — show a compact marker.
  if (Array.isArray(v)) return `[${v.length} items]`;
  return String(v);
}

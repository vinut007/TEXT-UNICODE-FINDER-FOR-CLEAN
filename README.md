# Identifyy

100% browser-local inspector and cleaning tool for Unicode "invisible" characters in CSV, TXT, Excel, and Access files. Detects non-ASCII characters, Unicode whitespace, invisible/format characters, control characters, mojibake, and BOMs — highlights every occurrence with exact positions, then lets you safely clean and download the fixed file plus findings reports.

No upload, no server, no tracking. Everything runs in a Web Worker inside your browser.

## Quick start

```bash
npm install
npm run dev
```

Open the printed URL (default `http://localhost:5173`). Drag & drop a `.csv`, `.tsv`, `.txt`, `.log`, `.xlsx`, `.accdb`, or `.mdb` file (or paste text).

```bash
npm run build   # production build → dist/
npm run preview # preview the production build
```

## What it detects

| Category | Examples | Severity |
|---|---|---|
| Non-ASCII | é, ü, 中, emoji, curly quotes “ ” ‘ ’ | Recommended / Review |
| Unicode whitespace | NBSP U+00A0, thin space U+2009, ideographic space U+3000 | Recommended |
| Invisible / format | ZWSP U+200B, ZWJ U+200D, word joiner U+2060, soft hyphen U+00AD | Recommended |
| Control | C0 (except \t \n \r), C1, DEL | Review |
| Mojibake | UTF-8 bytes misread as Latin-1/CP1252 ("Ã©" for "é", "â€™" for "’") | Encoding problem |
| BOM | UTF-8/UTF-16 byte-order marks | Info |

Every finding is aggregated by character (code point) with a total count, all occurrences, a human-readable name, category, severity, and a suggested replacement. Positions are 1-based Unicode code-point offsets (not UTF-16 code units, not UTF-8 bytes).

## Cleaning

- **Clean File dialog** — review every replaceable finding, pre-selected by severity, see occurrence and cell/field/line impact, then apply a batch.
- **Inspector actions** — replace one occurrence or all occurrences of the selected character.
- **Undo / redo** (Ctrl+Z / Ctrl+Y) — every applied batch is reversible; the original file is never modified.
- **Allowed / hidden** — mark a character as intentionally allowed, or hide a category from the view without deleting it.
- Mojibake is **never** auto-rewritten — encoding damage needs a re-export at the source; the tool only reports it.

After each cleaning run the document is re-analyzed so highlights, counts, and positions stay in sync with the cleaned state.

## Exports

- **Cleaned file** — TXT/CSV serialized with the original line endings and quoting; XLSX rebuilt via SheetJS (values + basic formatting; formulas/charts/pivots may be lost — a warning is shown). Access databases are cleaned in memory and exported as an `.xlsx` workbook (one sheet per table) because browsers cannot write `.accdb` files.
- **Findings report (CSV / JSON)** — every finding with code point, name, category, severity, recommendation, and all recorded locations (truncated lists are flagged).

## Architecture

```
src/
  types/analysis.ts        shared types, worker protocol, stage list
  lib/engine/              scan.ts, analyze.ts, csv.ts, excel.ts, access.ts,
                           encoding.ts, clean.ts, export.ts, unit-index.ts
  lib/unicode/             code point names + block/category tables
  workers/analyze.worker.ts  Web Worker with progress + cancel
  store/useAnalysisStore.ts  zustand store (screen, filters, ops chain, history)
  components/
    landing/               Navbar, UploadSection, Features, Footer, …
    analysis/              AnalysisScreen (8-stage progress)
    workspace/             Workspace shell, sidebars, previews (virtualized),
                           CleanDialog, ExportDialog, SummaryCards
```

- CSV parsing is done by a position-tracking state machine (quoted/multiline fields, CRLF/LF/CR, delimiter sniffing) so every character maps back to an exact record/field/line/offset.
- Excel files are read with SheetJS (`.xlsx/.xls/.xlsm/.ods`), displayed as strings, and exported by re-writing cell values.
- Access databases (`.accdb/.mdb`, Access 97–2019) are read with `mdb-reader` in the worker; each table is mapped to the same grid model as an Excel worksheet, so highlighting, cleaning, and the virtualized preview work unchanged. Tables are read in batches (25k rows) with progress reporting. Password-protected or corrupt files cannot be read.
- Cleaning uses an immutable op chain: each batch is applied on top of the previous state, rebuilt from the original file for undo/redo, so repeated cleaning stays correct.
- Previews are virtualized (fixed row heights / windowed cells) and render highlights through a `UnitIndex` keyed by line / CSV record+field / sheet cell. Highlighting works by first building a character map of all findings (including multi-code-point mojibake sequences), then matching every displayed character against the map — stored offsets are never trusted for rendering.
- `mdb-reader`'s browser build needs a few Node builtins (`stream`, `events`, `string_decoder`, `util`); these are aliased to browser implementations in `vite.config.ts`, and a small `Buffer` polyfill (`src/lib/buffer-polyfill.ts`) is loaded before `mdb-reader`.

## Privacy

- Files never leave the browser. No network requests are made after page load.
- Clear File destroys all in-memory state (file, parsed data, results) immediately.

## Deploy — Cloudflare Pages

Static site; no functions required.

```bash
npm run build
npx wrangler pages deploy dist --project-name=identifyy
```

Or connect the repo in the Cloudflare dashboard with build command `npm run build` and output directory `dist`.

Optional `wrangler.toml`:

```toml
name = "identifyy"
compatibility_date = "2024-11-01"
pages_build_output_dir = "dist"
```

Optional `public/_headers`:

```
/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: no-referrer
  Permissions-Policy: camera=(), microphone=(), geolocation=()
```

## Known limitations

- Positions are code-point based; surrogate pairs count as one position.
- Very large files are processed in memory — multi-hundred-MB files may exhaust the browser heap (a size warning is shown past the soft limit).
- Excel export does not preserve macros, pivot tables, charts, conditional formatting, or data validation; only string cells are cleaned.
- Access support reads tables (not queries, forms, or reports), caps at 50 tables per database, and cannot open password-protected files. Cleaned Access data is exported as `.xlsx` (browsers cannot write `.accdb`).
- Mojibake detection is heuristic (pairing rules for Latin-1/CP1252 tails) and flags patterns for manual review — it never rewrites them.

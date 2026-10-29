import { create } from 'zustand';
import { DEFAULT_SCAN_OPTIONS, isGridFileType } from '@/types/analysis';
import type {
  AnalysisResult,
  CleanOp,
  FileType,
  FindingCategory,
  Location,
  ScanOptions,
  SeverityFilter,
  WorkerProgress,
} from '@/types/analysis';
import { analyzeWorker, MAX_BUFFER_BYTES } from '@/lib/worker';
import { downloadBlob, formatBytes } from '@/lib/utils';
import { exportErrorWordsCsv } from '@/lib/engine/export';

export type Screen = 'landing' | 'analyzing' | 'workspace';
export type CenterView = 'table' | 'text' | 'excel';
export type InspectorView = 'inspector' | 'recommendations';

export interface NavTarget {
  token: number;
  line?: number;
  row?: number;
  col?: number;
  sheet?: string;
  cell?: string;
}

export interface Toast {
  id: number;
  kind: 'info' | 'success' | 'error';
  message: string;
}

export interface Filters {
  categories: FindingCategory[];
  severity: SeverityFilter;
  search: string;
}

const ALL_CATEGORIES: FindingCategory[] = [
  'non-ascii', 'whitespace', 'invisible', 'control', 'mojibake', 'bom',
];

interface State {
  screen: Screen;
  theme: 'dark' | 'light';

  /* upload */
  file: File | null;
  fileType: FileType | null;
  uploadError: string | null;
  scanOptions: ScanOptions;
  pasteOpen: boolean;

  /* analysis */
  progress: WorkerProgress | null;
  analysisError: string | null;
  cancelling: boolean;

  /* results */
  result: AnalysisResult | null;
  originalResult: AnalysisResult | null;

  /* workspace */
  centerView: CenterView;
  escapedView: boolean;
  inspectorView: InspectorView;
  selectedKey: string | null;
  selectedLocationId: string | null;
  inspectedCell: { sheet: string; row: number; col: number } | null;
  activeSheet: string | null;
  filters: Filters;
  nav: NavTarget | null;
  leftDrawerOpen: boolean;
  rightDrawerOpen: boolean;

  /* cleaning — chain[i] is a batch applied on top of chain[i-1] */
  chain: CleanOp[][];
  history: CleanOp[][][];
  historyIndex: number;
  appliedCount: number;
  cleaning: boolean;
  cleanDialogOpen: boolean;

  ignoredKeys: string[];
  allowedKeys: string[];
  toast: Toast | null;

  /* actions */
  setTheme: (t: 'dark' | 'light') => void;
  setFile: (file: File | null, type?: FileType | null) => void;
  setScanOptions: (patch: Partial<ScanOptions>) => void;
  setPasteOpen: (open: boolean) => void;
  startAnalysis: () => void;
  cancelAnalysis: () => void;
  reset: () => void;
  goToLanding: () => void;

  setCenterView: (v: CenterView) => void;
  setEscapedView: (v: boolean) => void;
  setInspectorView: (v: InspectorView) => void;
  selectFinding: (key: string | null, loc?: Location) => void;
  setInspectedCell: (cell: { sheet: string; row: number; col: number } | null) => void;
  setActiveSheet: (name: string) => void;
  setFilters: (patch: Partial<Filters>) => void;
  toggleCategory: (c: FindingCategory) => void;
  navigate: (target: Omit<NavTarget, 'token'>) => void;
  setDrawers: (left?: boolean, right?: boolean) => void;

  commitBatch: (batch: CleanOp[]) => Promise<void>;
  exportErrorWords: () => void;
  undo: () => void;
  redo: () => void;
  setCleanDialogOpen: (open: boolean) => void;
  setCleaning: (v: boolean) => void;
  ignoreFinding: (key: string) => void;
  allowFinding: (key: string) => void;
  unignoreFinding: (key: string) => void;
  showToast: (kind: Toast['kind'], message: string) => void;
  dismissToast: () => void;
  setAnalysisError: (msg: string | null) => void;
}

function detectFileType(name: string): FileType | null {
  const ext = name.toLowerCase().split('.').pop() ?? '';
  if (ext === 'csv' || ext === 'tsv') return 'csv';
  if (ext === 'xlsx' || ext === 'xls' || ext === 'xlsm' || ext === 'ods') return 'excel';
  if (ext === 'accdb' || ext === 'mdb' || ext === 'accde') return 'access';
  if (ext === 'txt' || ext === 'log' || ext === 'text' || ext === 'md') return 'text';
  return null;
}

export const useStore = create<State>((set, get) => ({
  screen: 'landing',
  theme: 'dark',

  file: null,
  fileType: null,
  uploadError: null,
  scanOptions: { ...DEFAULT_SCAN_OPTIONS },
  pasteOpen: false,

  progress: null,
  analysisError: null,
  cancelling: false,

  result: null,
  originalResult: null,

  centerView: 'table',
  escapedView: false,
  inspectorView: 'inspector',
  selectedKey: null,
  selectedLocationId: null,
  inspectedCell: null,
  activeSheet: null,
  filters: { categories: [...ALL_CATEGORIES], severity: 'all', search: '' },
  nav: null,
  leftDrawerOpen: false,
  rightDrawerOpen: false,

  chain: [],
  history: [[]],
  historyIndex: 0,
  appliedCount: 0,
  cleaning: false,
  cleanDialogOpen: false,

  ignoredKeys: [],
  allowedKeys: [],
  toast: null,

  setTheme: (theme) => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    set({ theme });
  },

  setFile: (file, type) => {
    if (!file) {
      set({ file: null, fileType: null, uploadError: null });
      return;
    }
    const t = type ?? detectFileType(file.name);
    if (!t) {
      set({
        uploadError: `Unsupported file type "${file.name.split('.').pop()}". Supported: .csv .tsv .xlsx .xls .accdb .mdb .txt .log`,
        file: null,
        fileType: null,
      });
      return;
    }
    set({ file, fileType: t, uploadError: null });
  },

  setScanOptions: (patch) => set((s) => ({ scanOptions: { ...s.scanOptions, ...patch } })),
  setPasteOpen: (pasteOpen) => set({ pasteOpen }),

  startAnalysis: () => {
    const { file, fileType, scanOptions } = get();
    if (!file || !fileType) return;

    // Excel and Access are read entirely into memory (SheetJS / mdb-reader cannot
    // stream), so reject oversized files up front with a clear message instead of
    // crashing the tab inside the worker.
    if ((fileType === 'excel' || fileType === 'access') && file.size > MAX_BUFFER_BYTES) {
      set({
        screen: 'landing',
        progress: null,
        analysisError: `File is too large (${formatBytes(file.size)}). Excel and Access files are limited to ${formatBytes(MAX_BUFFER_BYTES)} because they are read entirely into memory.`,
        cancelling: false,
        result: null,
        originalResult: null,
      });
      return;
    }

    set({
      screen: 'analyzing',
      progress: null,
      analysisError: null,
      cancelling: false,
      result: null,
      originalResult: null,
      chain: [],
      history: [[]],
      historyIndex: 0,
      appliedCount: 0,
      selectedKey: null,
      selectedLocationId: null,
      nav: null,
      filters: { categories: [...ALL_CATEGORIES], severity: 'all', search: '' },
      ignoredKeys: [],
      allowedKeys: [],
    });
    runAnalysis(file, fileType, scanOptions, set, get, false);
  },

  cancelAnalysis: () => {
    set({ cancelling: true });
    analyzeWorker.cancel();
  },

  reset: () => {
    analyzeWorker.cancel();
    set({
      screen: 'landing',
      file: null,
      fileType: null,
      uploadError: null,
      progress: null,
      analysisError: null,
      cancelling: false,
      result: null,
      originalResult: null,
      chain: [],
      history: [[]],
      historyIndex: 0,
      appliedCount: 0,
      selectedKey: null,
      selectedLocationId: null,
      inspectedCell: null,
      activeSheet: null,
      nav: null,
      cleanDialogOpen: false,
      leftDrawerOpen: false,
      rightDrawerOpen: false,
      toast: null,
      centerView: 'table',
      escapedView: false,
      inspectorView: 'inspector',
      ignoredKeys: [],
      allowedKeys: [],
    });
  },

  goToLanding: () => set({ screen: 'landing', analysisError: null, progress: null }),

  setCenterView: (centerView) => set({ centerView }),
  setEscapedView: (escapedView) => set({ escapedView }),
  setInspectorView: (inspectorView) => set({ inspectorView }),

  selectFinding: (key, loc) => {
    set({
      selectedKey: key,
      selectedLocationId: loc?.id ?? null,
      inspectedCell: null,
      rightDrawerOpen: true,
      inspectorView: 'inspector',
    });
    if (key && loc) {
      get().navigate({
        line: loc.line,
        row: loc.dataRow && loc.dataRow > 0 ? loc.dataRow : loc.cellRow,
        col: loc.fieldIndex !== undefined ? loc.fieldIndex + 1 : loc.cellCol,
        sheet: loc.sheet,
        cell: loc.cell,
      });
    }
  },

  setInspectedCell: (inspectedCell) =>
    set({ inspectedCell, selectedKey: null, selectedLocationId: null, rightDrawerOpen: true }),

  setActiveSheet: (activeSheet) => set({ activeSheet }),
  setFilters: (patch) => set((s) => ({ filters: { ...s.filters, ...patch } })),
  toggleCategory: (c) =>
    set((s) => {
      const has = s.filters.categories.includes(c);
      return {
        filters: {
          ...s.filters,
          categories: has
            ? s.filters.categories.filter((x) => x !== c)
            : [...s.filters.categories, c],
        },
      };
    }),
  navigate: (target) => set({ nav: { ...target, token: Date.now() + Math.random() } }),
  setDrawers: (left, right) =>
    set((s) => ({
      leftDrawerOpen: left ?? s.leftDrawerOpen,
      rightDrawerOpen: right ?? s.rightDrawerOpen,
    })),

  /** Append a new batch of ops (relative to the current document) and re-analyze. */
  commitBatch: (batch) => {
    if (!batch.length) return Promise.resolve();
    const { chain, history, historyIndex } = get();
    const trimmed = history.slice(0, historyIndex + 1);
    const nextChain = [...chain, batch];
    set({
      chain: nextChain,
      history: [...trimmed, nextChain],
      historyIndex: trimmed.length,
      cleanDialogOpen: false,
    });
    return reanalyzeWithOps(get, set, nextChain);
  },

  exportErrorWords: () => {
    const { result } = get();
    if (!result) return;
    const out = exportErrorWordsCsv(result);
    downloadBlob(out.bytes as BlobPart, out.fileName, out.mime);
    get().showToast(
      'success',
      `Exported ${result.findings.length} error code point(s) to ${out.fileName}`,
    );
  },

  undo: () => {
    const { historyIndex, history } = get();
    if (historyIndex <= 0) return;
    const idx = historyIndex - 1;
    set({ historyIndex: idx, chain: history[idx] });
    get().showToast('info', 'Undo — re-analyzing previous state…');
    void reanalyzeWithOps(get, set, history[idx]);
  },

  redo: () => {
    const { historyIndex, history } = get();
    if (historyIndex >= history.length - 1) return;
    const idx = historyIndex + 1;
    set({ historyIndex: idx, chain: history[idx] });
    get().showToast('info', 'Redo — re-analyzing…');
    void reanalyzeWithOps(get, set, history[idx]);
  },

  setCleanDialogOpen: (cleanDialogOpen) => set({ cleanDialogOpen }),
  setCleaning: (cleaning) => set({ cleaning }),

  ignoreFinding: (key) =>
    set((s) => ({ ignoredKeys: [...s.ignoredKeys, key], selectedKey: null })),
  allowFinding: (key) =>
    set((s) => ({
      allowedKeys: s.allowedKeys.includes(key) ? s.allowedKeys : [...s.allowedKeys, key],
    })),
  unignoreFinding: (key) =>
    set((s) => ({
      ignoredKeys: s.ignoredKeys.filter((k) => k !== key),
      allowedKeys: s.allowedKeys.filter((k) => k !== key),
    })),

  showToast: (kind, message) => set({ toast: { id: Date.now(), kind, message } }),
  dismissToast: () => set({ toast: null }),
  setAnalysisError: (analysisError) => set({ analysisError }),
}));

/* ------------------------------ analysis ------------------------------ */

type SetFn = (partial: Partial<State> | ((s: State) => Partial<State>)) => void;
type GetFn = () => State;

async function runAnalysis(
  file: File,
  fileType: FileType,
  options: ScanOptions,
  set: SetFn,
  get: GetFn,
  isReanalysis: boolean,
): Promise<void> {
  try {
    const response = await analyzeWorker.analyze(file, fileType, options, (p) => {
      set({ progress: p });
    });
    if (response.type === 'cancelled') {
      if (isReanalysis) {
        set({ cleaning: false });
        get().showToast('info', 'Re-analysis cancelled.');
      } else {
        set({ screen: 'landing', progress: null, cancelling: false });
      }
      return;
    }
    if (response.type === 'error') {
      if (isReanalysis) {
        set({ cleaning: false });
        get().showToast('error', response.message);
      } else {
        set({ analysisError: response.message, screen: 'landing' });
      }
      return;
    }

    const result = response.result;
    set((s) => ({
      result,
      originalResult: isReanalysis ? s.originalResult : result,
      progress: null,
      cancelling: false,
      cleaning: false,
      screen: 'workspace',
      activeSheet: result.excel?.sheets[0]?.name ?? null,
      centerView: isGridFileType(result.fileType)
        ? 'excel'
        : result.fileType === 'csv'
          ? 'table'
          : 'text',
      selectedKey: null,
      selectedLocationId: null,
    }));

    if (isReanalysis) {
      const n = get().appliedCount;
      get().showToast('success', `Applied ${n} replacement${n === 1 ? '' : 's'} — re-scanned.`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Analysis failed.';
    if (isReanalysis) set({ cleaning: false });
    set({ analysisError: message });
    get().showToast('error', message);
  }
}

/**
 * Rebuild the working copy from the ORIGINAL document + op chain, wrap it in a
 * fresh File and re-analyze so highlights/counts match the cleaned state.
 */
async function reanalyzeWithOps(
  get: GetFn,
  set: SetFn,
  chain: CleanOp[][],
): Promise<void> {
  const { originalResult, file, fileType, scanOptions } = get();
  if (!originalResult || !fileType) return;

  if (chain.length === 0) {
    set({ result: originalResult, cleaning: false, appliedCount: 0 });
    get().showToast('info', 'Restored original file.');
    return;
  }

  set({ cleaning: true });
  try {
    const { exportCleanedTextOrCsv, exportCleanedExcel, buildCleanedDoc } = await import(
      '@/lib/engine/export'
    );

    if (fileType === 'access') {
      // Browsers cannot write .accdb — clean the in-memory tables and
      // re-analyze them directly via the worker's preloaded-grid path.
      const { doc, count } = buildCleanedDoc(originalResult, chain);
      if (!doc.excel) throw new Error('Access tables missing from the analysis result.');
      set({ appliedCount: count });
      const response = await analyzeWorker.analyze(
        null,
        'access',
        scanOptions,
        (p) => set({ progress: p }),
        doc.excel,
      );
      await finishReanalysis(response, set, get);
      return;
    }

    let cleanedFile: File;
    if (fileType === 'excel') {
      const out = await exportCleanedExcel(file!, originalResult, chain);
      cleanedFile = new File([out.bytes as BlobPart], file!.name, {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      });
    } else {
      const out = exportCleanedTextOrCsv(originalResult, chain);
      cleanedFile = new File([out.bytes as BlobPart], file!.name, { type: 'text/plain' });
    }

    set({ appliedCount: buildCleanedDoc(originalResult, chain).count });
    await runAnalysis(cleanedFile, fileType, scanOptions, set, get, true);
  } catch (err) {
    set({ cleaning: false });
    get().showToast('error', err instanceof Error ? err.message : 'Cleaning failed.');
  }
}

/** Shared completion handler for re-analysis responses (Access preloaded path). */
async function finishReanalysis(
  response: { type: string; result?: AnalysisResult; message?: string },
  set: SetFn,
  get: GetFn,
): Promise<void> {
  if (response.type === 'cancelled') {
    set({ cleaning: false });
    get().showToast('info', 'Re-analysis cancelled.');
    return;
  }
  if (response.type === 'error') {
    set({ cleaning: false });
    get().showToast('error', response.message ?? 'Re-analysis failed.');
    return;
  }
  const result = response.result!;
  set((s) => ({
    result,
    originalResult: s.originalResult,
    progress: null,
    cancelling: false,
    cleaning: false,
    screen: 'workspace',
    activeSheet: result.excel?.sheets[0]?.name ?? null,
    selectedKey: null,
    selectedLocationId: null,
  }));
  const n = get().appliedCount;
  get().showToast('success', `Applied ${n} replacement${n === 1 ? '' : 's'} — re-scanned.`);
}

/** Public helper used by the Clean dialog to commit a batch of ops. */
export async function commitBatch(batch: CleanOp[]): Promise<void> {
  await useStore.getState().commitBatch(batch);
}

/** Download one line per suspicious finding (error word) as UTF-8 TXT. */
export function exportErrorWords(): void {
  useStore.getState().exportErrorWords();
}

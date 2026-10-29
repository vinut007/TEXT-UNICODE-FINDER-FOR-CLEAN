import { useEffect } from 'react';
import {
  AlertTriangle,
  FileText,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeft,
  PanelRight,
  Redo2,
  SearchCheck,
  Sun,
  Undo2,
  Upload,
} from 'lucide-react';
import { useStore } from '@/store/useAnalysisStore';
import { isGridFileType, type AnalysisResult } from '@/types/analysis';
import { cn, formatBytes, formatDuration } from '@/lib/utils';
import { Tabs } from '@/components/ui/Tabs';
import { Badge, Spinner } from '@/components/ui/Badge';
import { LeftSidebar } from './LeftSidebar';
import { RightSidebar } from './RightSidebar';
import { TextPreview } from './TextPreview';
import { CsvPreview } from './CsvPreview';
import { ExcelPreview } from './ExcelPreview';
import { SummaryCards } from './SummaryCards';

export function Workspace({ result }: { result: AnalysisResult }) {
  const file = useStore((s) => s.file);
  const centerView = useStore((s) => s.centerView);
  const setCenterView = useStore((s) => s.setCenterView);
  const escapedView = useStore((s) => s.escapedView);
  const setEscapedView = useStore((s) => s.setEscapedView);
  const leftDrawerOpen = useStore((s) => s.leftDrawerOpen);
  const rightDrawerOpen = useStore((s) => s.rightDrawerOpen);
  const setDrawers = useStore((s) => s.setDrawers);
  const cleaning = useStore((s) => s.cleaning);
  const chain = useStore((s) => s.chain);
  const historyIndex = useStore((s) => s.historyIndex);
  const history = useStore((s) => s.history);
  const undo = useStore((s) => s.undo);
  const redo = useStore((s) => s.redo);
  const goToLanding = useStore((s) => s.goToLanding);
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const reset = useStore((s) => s.reset);

  // keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      } else if (mod && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        e.preventDefault();
        redo();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  const canUndo = historyIndex > 0;
  const canRedo = historyIndex < history.length - 1;

  const centerTabs = isGridFileType(result.fileType)
    ? [{ value: 'excel', label: result.fileType === 'access' ? 'Tables' : 'Worksheet' }]
    : result.fileType === 'csv'
      ? [{ value: 'table', label: 'Table' }]
      : [{ value: 'text', label: 'Text' }];

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-surface text-ink">
      {/* top bar */}
      <header className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line bg-surface-raised px-3 py-2">
        <button
          className="btn-ghost !px-2 lg:hidden"
          onClick={() => setDrawers(!leftDrawerOpen)}
          aria-label="Toggle filters sidebar"
        >
          {leftDrawerOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeft className="h-4 w-4" />}
        </button>

        <button
          className="flex items-center gap-1.5 text-[13px] font-extrabold tracking-tight transition-colors hover:text-yellow-500"
          onClick={goToLanding}
          title="Back to upload"
        >
          <SearchCheck className="h-4 w-4 text-yellow-500" />
          <span className="hidden sm:inline">Unicode Inspector</span>
          <span className="rounded bg-yellow-400/15 px-1 py-0.5 text-[9px] font-bold text-yellow-500">
            PRO
          </span>
        </button>

        <span className="mx-1 hidden h-5 w-px bg-line sm:block" />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FileText className="h-3.5 w-3.5 shrink-0 text-ink-faint" />
          <span className="truncate text-[12px] font-semibold text-ink" title={result.fileName}>
            {result.fileName}
          </span>
          <span className="hidden font-mono text-[10px] text-ink-faint md:inline">
            {formatBytes(result.fileSize)} · {result.encoding} · {formatDuration(result.durationMs)}
          </span>
          {result.hasBom ? <Badge tone="sky">BOM</Badge> : null}
          {result.warnings.length > 0 ? (
            <span className="flex items-center gap-1 text-[10px] font-semibold text-yellow-500">
              <AlertTriangle className="h-3 w-3" />
              {result.warnings.length}
            </span>
          ) : null}
        </div>

        <div className="flex items-center gap-1">
          <button
            className="btn-ghost !px-2"
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            aria-label="Toggle theme"
            title="Toggle theme"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            className="btn-ghost !px-2"
            onClick={undo}
            disabled={!canUndo}
            aria-label="Undo"
            title="Undo (Ctrl+Z)"
          >
            <Undo2 className="h-4 w-4" />
          </button>
          <button
            className="btn-ghost !px-2"
            onClick={redo}
            disabled={!canRedo}
            aria-label="Redo"
            title="Redo (Ctrl+Y)"
          >
            <Redo2 className="h-4 w-4" />
          </button>
          <button className="btn-danger !px-2" onClick={reset} aria-label="Clear file" title="Clear file">
            <Upload className="h-4 w-4 rotate-180" />
          </button>
          <button
            className="btn-ghost !px-2 xl:hidden"
            onClick={() => setDrawers(undefined, !rightDrawerOpen)}
            aria-label="Toggle inspector sidebar"
          >
            <PanelRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      {/* summary */}
      <div className="shrink-0 border-b border-line px-3 py-2">
        <SummaryCards result={result} />
      </div>

      {/* body */}
      <div className="relative flex min-h-0 flex-1">
        {/* left drawer (mobile) */}
        {(leftDrawerOpen || rightDrawerOpen) && (
          <div
            className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-[1px] xl:hidden"
            onClick={() => setDrawers(false, false)}
            aria-hidden
          />
        )}

        <aside
          className={cn(
            'absolute inset-y-0 left-0 z-40 w-[280px] shrink-0 border-r border-line transition-transform xl:relative xl:z-auto xl:translate-x-0',
            leftDrawerOpen ? 'translate-x-0' : '-translate-x-full',
          )}
        >
          <LeftSidebar result={result} />
        </aside>

        {/* center */}
        <main className="flex min-w-0 flex-1 flex-col bg-surface">
          <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-line px-3 py-1.5">
            <Tabs
              size="sm"
              items={centerTabs}
              value={centerView === 'text' || centerView === 'table' || centerView === 'excel' ? centerView : 'text'}
              onChange={(v) => setCenterView(v as typeof centerView)}
            />
            {!isGridFileType(result.fileType) ? (
              <button
                className={cn(
                  'rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors',
                  escapedView
                    ? 'border-yellow-400/60 bg-yellow-400/15 text-yellow-500'
                    : 'border-line text-ink-muted hover:text-ink',
                )}
                onClick={() => setEscapedView(!escapedView)}
                title="Show escape sequences for invisible characters"
              >
                Escaped view
              </button>
            ) : null}
            <span className="ml-auto hidden text-[10px] text-ink-faint sm:block">
              Click any highlighted character to inspect it
            </span>
          </div>

          <div className="min-h-0 flex-1 overflow-hidden">
            {centerView === 'excel' && isGridFileType(result.fileType) ? (
              <ExcelPreview result={result} />
            ) : centerView === 'table' && result.fileType === 'csv' ? (
              <CsvPreview result={result} />
            ) : (
              <TextPreview result={result} />
            )}
          </div>
        </main>

        {/* right drawer (mobile) */}
        <aside
          className={cn(
            'absolute inset-y-0 right-0 z-40 w-[320px] shrink-0 border-l border-line transition-transform xl:relative xl:z-auto xl:translate-x-0',
            rightDrawerOpen ? 'translate-x-0' : 'translate-x-full',
          )}
        >
          <RightSidebar result={result} />
        </aside>

        {/* cleaning overlay */}
        {cleaning ? (
          <div className="absolute inset-0 z-50 grid place-items-center bg-surface/70 backdrop-blur-[1px]">
            <div className="panel flex items-center gap-3 px-5 py-4">
              <Spinner className="h-5 w-5 text-sky-400" />
              <div>
                <p className="text-[13px] font-bold text-ink">Applying replacements…</p>
                <p className="text-[11px] text-ink-muted">Re-scanning the cleaned document.</p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

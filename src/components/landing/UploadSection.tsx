import { useRef, useState } from 'react';
import {
  ArrowRight,
  ClipboardPaste,
  Database,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  Sparkles,
  Table2,
  Upload,
  X,
} from 'lucide-react';
import { useStore } from '@/store/useAnalysisStore';
import { Dialog } from '@/components/ui/Dialog';
import { formatBytes } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { FileType } from '@/types/analysis';

const FORMATS: { type: FileType; label: string; ext: string; icon: typeof FileText }[] = [
  { type: 'csv', label: 'CSV', ext: '.csv · .tsv', icon: Table2 },
  { type: 'excel', label: 'Excel', ext: '.xlsx · .xls', icon: FileSpreadsheet },
  { type: 'access', label: 'Access', ext: '.accdb · .mdb', icon: Database },
  { type: 'text', label: 'TXT', ext: '.txt · .log', icon: FileText },
];

const MODE_OPTIONS = [
  { key: 'allNonAscii', label: 'All non-ASCII characters' },
  { key: 'unicodeWhitespace', label: 'Unicode whitespace' },
  { key: 'invisible', label: 'Invisible & formatting' },
  { key: 'control', label: 'Control characters' },
  { key: 'mojibake', label: 'Mojibake patterns' },
] as const;

export function UploadSection() {
  const {
    file,
    fileType,
    uploadError,
    scanOptions,
    setFile,
    setScanOptions,
    startAnalysis,
    pasteOpen,
    setPasteOpen,
  } = useStore();

  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const [showModes, setShowModes] = useState(false);
  const [pasteText, setPasteText] = useState('');

  const onFiles = (files: FileList | null) => {
    const f = files?.[0];
    if (f) setFile(f);
  };

  const scrollToUpload = () => {
    document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const submitPaste = () => {
    if (!pasteText.trim()) return;
    const f = new File([pasteText], 'pasted-text.txt', { type: 'text/plain' });
    setFile(f, 'text');
    setPasteOpen(false);
    setPasteText('');
    setTimeout(scrollToUpload, 60);
  };

  return (
    <section className="relative overflow-hidden pt-14 pb-24 sm:pt-20">
      {/* decorative glow orbs */}
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-[420px] w-[820px] -translate-x-1/2 rounded-full bg-sky-500/10 blur-3xl" />
        <div className="absolute right-[8%] top-40 h-56 w-56 rounded-full bg-yellow-400/10 blur-3xl" />
        <div className="absolute left-[6%] top-56 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl" />
      </div>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="mx-auto max-w-3xl text-center animate-fade-up">
          <span className="inline-flex items-center gap-2 rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-sky-500">
            <Sparkles className="h-3.5 w-3.5" />
            100% local · no uploads · no accounts
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-[1.05] tracking-tight text-ink sm:text-6xl">
            Find Every <span className="shimmer-text">Hidden Character.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-ink-muted sm:text-lg">
            Detect non-ASCII characters, invisible spaces, encoding issues, and suspicious
            Unicode in your CSV, Excel, Access, and text files. Find the exact location and fix your
            data safely.
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <button className="btn-primary !px-6 !py-3 text-[15px]" onClick={scrollToUpload}>
              Analyze a File
              <ArrowRight className="h-4 w-4" />
            </button>
            <button className="btn-ghost !px-6 !py-3 text-[15px]" onClick={() => setPasteOpen(true)}>
              <ClipboardPaste className="h-4 w-4" />
              Paste Text
            </button>
          </div>
        </div>

        {/* ---------------- upload card ---------------- */}
        <div id="upload" className="mx-auto mt-12 max-w-3xl scroll-mt-24">
          <div className={cn('grad-border rounded-2xl p-1 shadow-panel', dragOver && 'grad-border-active')}>
            <div className="rounded-[14px] bg-surface-raised p-5 sm:p-7">
              <input
                ref={inputRef}
                type="file"
                className="sr-only"
                accept=".csv,.tsv,.xlsx,.xls,.xlsm,.accdb,.mdb,.accde,.txt,.log,.text"
                onChange={(e) => {
                  onFiles(e.target.files);
                  e.target.value = '';
                }}
              />

              {/* dropzone / file slot */}
              {!file ? (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    onFiles(e.dataTransfer.files);
                  }}
                  onClick={() => inputRef.current?.click()}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') inputRef.current?.click();
                  }}
                  className={cn(
                    'flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-12 text-center transition-all duration-200',
                    dragOver
                      ? 'border-sky-400 bg-sky-500/10 scale-[1.01]'
                      : 'border-line hover:border-sky-500/60 hover:bg-sky-500/5',
                  )}
                >
                  <span
                    className={cn(
                      'grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-sky-500/20 to-violet-500/20 text-sky-400 transition-transform',
                      dragOver && 'scale-110',
                    )}
                  >
                    <Upload className="h-7 w-7" />
                  </span>
                  <p className="mt-4 text-lg font-bold text-ink">Drop your file here</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    or{' '}
                    <span className="font-semibold text-sky-400 underline decoration-sky-400/40 underline-offset-2">
                      browse files
                    </span>{' '}
                    from your computer
                  </p>
                </div>
              ) : (
                <div className="flex items-center gap-3 rounded-xl border border-line bg-surface px-4 py-3.5 animate-fade-up">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-sky-500/12 text-sky-400">
                    {fileType === 'excel' ? (
                      <FileSpreadsheet className="h-5 w-5" />
                    ) : fileType === 'access' ? (
                      <Database className="h-5 w-5" />
                    ) : fileType === 'csv' ? (
                      <Table2 className="h-5 w-5" />
                    ) : (
                      <FileText className="h-5 w-5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-ink" title={file.name}>
                      {file.name}
                    </p>
                    <p className="text-xs text-ink-muted">
                      {formatBytes(file.size)} ·{' '}
                      {fileType === 'excel'
                        ? 'Excel workbook'
                        : fileType === 'access'
                          ? 'Access database'
                          : fileType === 'csv'
                            ? 'Delimited text'
                            : 'Text file'}
                      {file.name.endsWith('.txt') && file.size === 0 ? '' : ''}
                    </p>
                  </div>
                  <button
                    className="btn-ghost h-8 w-8 shrink-0 !p-0"
                    onClick={() => setFile(null)}
                    aria-label="Remove selected file"
                    title="Remove file"
                  >
                    <X className="h-4 w-4" />
                  </button>
                  <button
                    className="btn-ghost !py-1.5 text-xs"
                    onClick={() => inputRef.current?.click()}
                  >
                    Replace
                  </button>
                </div>
              )}

              {/* format options */}
              <div className="mt-5 grid grid-cols-3 gap-2.5">
                {FORMATS.map((f) => {
                  const active = fileType === f.type && !!file;
                  const Icon = f.icon;
                  return (
                    <button
                      key={f.type}
                      onClick={() => inputRef.current?.click()}
                      className={cn(
                        'group flex flex-col items-center gap-1 rounded-xl border px-2 py-3 transition-all duration-150',
                        active
                          ? 'border-sky-500/70 bg-sky-500/10 text-sky-400 shadow-glow'
                          : 'border-line bg-surface text-ink-muted hover:border-sky-500/50 hover:text-ink',
                      )}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs font-bold">{f.label}</span>
                      <span className="text-[10px] text-ink-faint">{f.ext}</span>
                    </button>
                  );
                })}
              </div>

              {uploadError ? (
                <div className="mt-4 rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-2 text-xs font-medium text-rose-500 animate-fade-in">
                  {uploadError}
                </div>
              ) : null}

              {/* detection modes */}
              <div className="mt-4">
                <button
                  className="flex items-center gap-1.5 text-xs font-semibold text-ink-muted transition-colors hover:text-sky-400"
                  onClick={() => setShowModes((v) => !v)}
                  aria-expanded={showModes}
                >
                  <span className={cn('transition-transform', showModes && 'rotate-90')}>▸</span>
                  Detection modes
                </button>
                {showModes ? (
                  <div className="mt-2.5 flex flex-wrap gap-2 animate-fade-in">
                    {MODE_OPTIONS.map((m) => {
                      const on = scanOptions[m.key];
                      return (
                        <label
                          key={m.key}
                          className={cn(
                            'flex cursor-pointer select-none items-center gap-2 rounded-lg border px-2.5 py-1.5 text-[11px] font-semibold transition-all',
                            on
                              ? 'border-yellow-400/50 bg-yellow-400/10 text-yellow-500'
                              : 'border-line bg-surface text-ink-faint hover:text-ink-muted',
                          )}
                        >
                          <input
                            type="checkbox"
                            className="sr-only"
                            checked={on}
                            onChange={(e) => setScanOptions({ [m.key]: e.target.checked })}
                          />
                          <span
                            className={cn(
                              'grid h-3.5 w-3.5 place-items-center rounded-[4px] border text-[9px]',
                              on ? 'border-yellow-400 bg-yellow-400 text-slate-950' : 'border-ink-faint',
                            )}
                          >
                            {on ? '✓' : ''}
                          </span>
                          {m.label}
                        </label>
                      );
                    })}
                  </div>
                ) : null}
              </div>

              {/* actions */}
              <div className="mt-5 flex flex-col gap-3 border-t border-line pt-5 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-xs text-ink-muted">
                  <ShieldCheck className="h-4 w-4 text-emerald-500" />
                  Processed locally in your browser
                </div>
                <button
                  className="btn-primary !px-6 !py-2.5"
                  disabled={!file || !fileType}
                  onClick={startAnalysis}
                >
                  Start Analysis
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-ink-faint">
            Practical limits: browser memory caps large files (~300&nbsp;MB hard limit; files
            above ~64&nbsp;MB may be slow). Excel and Access analysis support standard workbooks
            and databases (Access 97–2019) — charts and macros are not executed, and password
            protected Access files cannot be read.
          </p>
        </div>
      </div>

      {/* paste dialog */}
      <Dialog
        open={pasteOpen}
        onClose={() => setPasteOpen(false)}
        title="Paste text to inspect"
        description="Paste any snippet — log lines, SQL, JSON, CSV rows — and scan it with the same engine."
        footer={
          <>
            <button className="btn-ghost !py-2" onClick={() => setPasteOpen(false)}>
              Cancel
            </button>
            <button className="btn-primary !py-2" disabled={!pasteText.trim()} onClick={submitPaste}>
              Load into analyzer
            </button>
          </>
        }
      >
        <textarea
          value={pasteText}
          onChange={(e) => setPasteText(e.target.value)}
          rows={12}
          spellCheck={false}
          placeholder={'Paste your text here…\n\nExample: Product\u200bName with a non-breaking\u00a0space.'}
          className="input font-mono text-xs leading-relaxed resize-y"
        />
        <p className="mt-2 text-[11px] text-ink-faint">
          The pasted text never leaves this browser tab.
        </p>
      </Dialog>
    </section>
  );
}

import {
  ArrowRight,
  Binary,
  Braces,
  CheckCircle2,
  Eye,
  Fingerprint,
  Globe,
  KeyRound,
  Layers,
  Lock,
  MapPin,
  MousePointerClick,
  ServerOff,
  ScanLine,
  ShieldCheck,
  Sparkles,
  Wand2,
  Zap,
} from 'lucide-react';

/* ------------------------------- Features ------------------------------- */

const FEATURES = [
  {
    icon: MapPin,
    title: 'Exact location tracking',
    body: 'Every hit maps to a line + column, CSV row + column header, or an Excel / Access cell reference such as C27 — including inside quoted and multiline fields.',
    tone: 'text-sky-400 bg-sky-500/12',
  },
  {
    icon: Eye,
    title: 'Invisible character detection',
    body: 'Zero-width spaces, joiners, word joiners, soft hyphens, directional marks and embedded BOMs are surfaced with distinct colors.',
    tone: 'text-violet-400 bg-violet-500/12',
  },
  {
    icon: ScanLine,
    title: 'Unicode whitespace audit',
    body: 'NBSP, narrow NBSP, ideographic space, thin/hair spaces and friends — the characters that quietly break splits, joins and matching.',
    tone: 'text-yellow-400 bg-yellow-400/12',
  },
  {
    icon: Binary,
    title: 'Mojibake heuristics',
    body: 'Flags classic double-encoding artifacts such as Ã©, â€™ and ï»¿ as review-worthy warnings — never auto-rewrites them.',
    tone: 'text-orange-400 bg-orange-500/12',
  },
  {
    icon: Wand2,
    title: 'Safe, previewed cleaning',
    body: 'See before/after impact, replace one occurrence or all matches of a character, apply recommendations selectively, and undo anything.',
    tone: 'text-emerald-400 bg-emerald-500/12',
  },
  {
    icon: Zap,
    title: 'Web Worker engine',
    body: 'Scans run off the main thread with real progress and cancellation, so the UI stays responsive on multi-megabyte files.',
    tone: 'text-sky-400 bg-sky-500/12',
  },
  {
    icon: Layers,
    title: 'Three preview modes',
    body: 'Spreadsheet grid for CSV, code-editor view with escaped text for TXT, and a real grid view for Excel and Access tables — never fake lines.',
    tone: 'text-violet-400 bg-violet-500/12',
  },
];

export function Features() {
  return (
    <section id="features" className="scroll-mt-20 border-t border-line/60 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <span className="label-cap text-sky-400">Features</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Built for people who move data for a living
          </h2>
          <p className="mt-4 text-ink-muted">
            ETL pipelines, spreadsheets and imports fail because of characters nobody can see.
            This tool makes them visible, locatable and fixable.
          </p>
        </div>

        <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="panel group p-5 transition-all duration-200 hover:-translate-y-1 hover:border-sky-500/40 hover:shadow-glow"
            >
              <span className={`grid h-10 w-10 place-items-center rounded-lg ${f.tone}`}>
                <f.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-sm font-bold text-ink">{f.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* -------------------------- Character Reference ------------------------- */

interface RefRow {
  char: string;
  name: string;
  cp: string;
  cat: string;
  problem: string;
  fix: string;
  tone: string;
}

const REFERENCE: RefRow[] = [
  {
    char: '␣',
    name: 'NO-BREAK SPACE',
    cp: 'U+00A0',
    cat: 'Whitespace',
    problem: 'Looks like a space, but resists trimming, splitting and matching.',
    fix: 'Replace with U+0020',
    tone: 'hl-whitespace',
  },
  {
    char: '␣',
    name: 'NARROW NO-BREAK SPACE',
    cp: 'U+202F',
    cat: 'Whitespace',
    problem: 'Common in French/academic text pasted into data; breaks joins.',
    fix: 'Replace with U+0020',
    tone: 'hl-whitespace',
  },
  {
    char: '␣',
    name: 'IDEOGRAPHIC SPACE',
    cp: 'U+3000',
    cat: 'Whitespace',
    problem: 'Full-width space from CJK text; treated as content, not padding.',
    fix: 'Replace with U+0020',
    tone: 'hl-whitespace',
  },
  {
    char: '​',
    name: 'ZERO WIDTH SPACE',
    cp: 'U+200B',
    cat: 'Invisible',
    problem: 'Zero-width; invisible in editors, poisons exact string matching.',
    fix: 'Remove',
    tone: 'hl-invisible',
  },
  {
    char: '‌',
    name: 'ZERO WIDTH NON-JOINER',
    cp: 'U+200C',
    cat: 'Invisible',
    problem: 'Controls ligatures invisibly; often embedded in pasted text.',
    fix: 'Review and remove',
    tone: 'hl-invisible',
  },
  {
    char: '‍',
    name: 'ZERO WIDTH JOINER',
    cp: 'U+200D',
    cat: 'Invisible',
    problem: 'Invisible; required in some emoji and scripts — verify context.',
    fix: 'Review before removing',
    tone: 'hl-invisible',
  },
  {
    char: '﻿',
    name: 'ZERO WIDTH NO-BREAK SPACE (BOM)',
    cp: 'U+FEFF',
    cat: 'BOM / Invisible',
    problem: 'Valid only as the first character; anywhere else it is junk.',
    fix: 'Remove embedded BOMs',
    tone: 'hl-bom',
  },
  {
    char: '⁠',
    name: 'WORD JOINER',
    cp: 'U+2060',
    cat: 'Invisible',
    problem: 'Prevents line breaks at its position; invisible everywhere else.',
    fix: 'Remove',
    tone: 'hl-invisible',
  },
  {
    char: '­',
    name: 'SOFT HYPHEN',
    cp: 'U+00AD',
    cat: 'Invisible',
    problem: 'Invisible unless a line breaks there; corrupts exact matching.',
    fix: 'Remove',
    tone: 'hl-invisible',
  },
  {
    char: '‘ ’',
    name: 'SINGLE QUOTATION MARKS',
    cp: 'U+2018 / U+2019',
    cat: 'Punctuation',
    problem: "Word-processor apostrophes (it's) that break ASCII parsers.",
    fix: "Optionally → '",
    tone: 'hl-nonascii',
  },
  {
    char: '“ ”',
    name: 'DOUBLE QUOTATION MARKS',
    cp: 'U+201C / U+201D',
    cat: 'Punctuation',
    problem: 'Curly quotes that break naive CSV and JSON escaping.',
    fix: 'Optionally → "',
    tone: 'hl-nonascii',
  },
  {
    char: 'Ã©',
    name: 'MOJIBAKE SEQUENCE',
    cp: 'varies',
    cat: 'Encoding',
    problem: 'UTF-8 bytes decoded as Windows-1252 (e.g. é → Ã©).',
    fix: 'Re-decode original file',
    tone: 'hl-mojibake',
  },
];

export function CharacterReference() {
  return (
    <section id="reference" className="scroll-mt-20 border-t border-line/60 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <span className="label-cap text-yellow-400">Character Reference</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              The usual suspects
            </h2>
            <p className="mt-4 text-ink-muted">
              Click a code point to open it in the Unicode Explorer. Every code point link in the
              app works the same way.
            </p>
          </div>
        </div>

        <div className="panel mt-8 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-line bg-surface/70 text-[11px] uppercase tracking-wider text-ink-faint">
                  <th className="px-4 py-3 font-semibold">Char</th>
                  <th className="px-4 py-3 font-semibold">Unicode name</th>
                  <th className="px-4 py-3 font-semibold">Code point</th>
                  <th className="px-4 py-3 font-semibold">Category</th>
                  <th className="px-4 py-3 font-semibold">Why it matters</th>
                  <th className="px-4 py-3 font-semibold">Suggested fix</th>
                </tr>
              </thead>
              <tbody>
                {REFERENCE.map((r) => (
                  <tr
                    key={r.cp + r.name}
                    className="border-b border-line/60 last:border-0 transition-colors hover:bg-surface/60"
                  >
                    <td className="px-4 py-3">
                      <span className={`hl ${r.tone} font-mono text-base`}>{r.char}</span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-ink">{r.name}</td>
                    <td className="px-4 py-3">
                      <a
                        href={
                          r.cp.startsWith('U+') && !r.cp.includes('/')
                            ? `https://unicode-explorer.com/c/${r.cp.slice(2)}`
                            : 'https://unicode-explorer.com/c/00A0'
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-xs font-semibold text-sky-400 underline decoration-sky-400/40 underline-offset-2 hover:text-sky-300"
                      >
                        {r.cp}
                      </a>
                    </td>
                    <td className="px-4 py-3 text-xs text-ink-muted">{r.cat}</td>
                    <td className="px-4 py-3 text-xs text-ink-muted">{r.problem}</td>
                    <td className="px-4 py-3 text-xs font-semibold text-yellow-500">{r.fix}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ----------------------------- How it works ----------------------------- */

const STEPS = [
  {
    icon: MousePointerClick,
    title: 'Drop a file',
    body: 'CSV, TSV, Excel, Access or plain text. Nothing is uploaded — the file stays in browser memory.',
  },
  {
    icon: ScanLine,
    title: 'Watch the scan',
    body: 'A Web Worker streams progress through decoding, Unicode scanning, whitespace and mojibake passes.',
  },
  {
    icon: Braces,
    title: 'Inspect findings',
    body: 'Jump from every finding to its exact line, row, column or cell. The inspector shows name, category and fix.',
  },
  {
    icon: CheckCircle2,
    title: 'Clean file',
    body: 'Preview each replacement, apply only what you approve, then download the fixed file.',
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="scroll-mt-20 border-t border-line/60 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="max-w-2xl">
          <span className="label-cap text-sky-400">How It Works</span>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
            Four steps from messy to clean
          </h2>
        </div>

        <ol className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <li key={s.title} className="panel relative p-5">
              <span className="absolute right-4 top-4 font-mono text-3xl font-extrabold text-line">
                0{i + 1}
              </span>
              <span className="grid h-10 w-10 place-items-center rounded-lg bg-sky-500/12 text-sky-400">
                <s.icon className="h-5 w-5" />
              </span>
              <h3 className="mt-4 text-sm font-bold text-ink">{s.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-ink-muted">{s.body}</p>
            </li>
          ))}
        </ol>

        <div className="panel mt-6 flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-bold text-ink">Ready to inspect a file?</h3>
            <p className="mt-1 text-sm text-ink-muted">
              Everything runs locally — your data never reaches a server.
            </p>
          </div>
          <a href="#upload" className="btn-primary shrink-0 !px-5 !py-2.5">
            Analyze a File
            <ArrowRight className="h-4 w-4" />
          </a>
        </div>
      </div>
    </section>
  );
}

/* -------------------------------- Privacy -------------------------------- */

const PRIVACY_POINTS = [
  {
    icon: ServerOff,
    title: 'No server, ever',
    body: 'Parsing, scanning and cleaning all execute in this browser tab. There is no backend endpoint to receive your file.',
  },
  {
    icon: KeyRound,
    title: 'No accounts or subscriptions',
    body: 'Open the page and work. No login, license key, API key or payment.',
  },
  {
    icon: Fingerprint,
    title: 'No telemetry on your data',
    body: 'Uploaded content is never stored persistently, never logged and never sent anywhere.',
  },
  {
    icon: Lock,
    title: 'Sanitized display',
    body: 'File content is rendered as text nodes — never as HTML — so malicious payloads cannot execute.',
  },
  {
    icon: ShieldCheck,
    title: 'Works offline',
    body: 'After the first load, the app shell works without network access (except optional font and reference links).',
  },
  {
    icon: Sparkles,
    title: 'Reset anytime',
    body: 'Clear File and Reset Analysis drop all in-memory copies immediately.',
  },
];

export function Privacy() {
  return (
    <section id="privacy" className="scroll-mt-20 border-t border-line/60 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <span className="label-cap text-yellow-400">Privacy</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Your data stays on your machine
            </h2>
            <p className="mt-4 text-ink-muted">
              Built for regulated environments: healthcare exports, financial files, customer
              lists. If it would be a problem for that file to leave your laptop, this tool is
              safe to use.
            </p>
            <div className="mt-6 inline-flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500">
              <Lock className="h-4 w-4" />
              Processed locally in your browser
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {PRIVACY_POINTS.map((p) => (
              <div key={p.title} className="panel p-4">
                <div className="flex items-center gap-2">
                  <p.icon className="h-4 w-4 text-sky-400" />
                  <h3 className="text-[13px] font-bold text-ink">{p.title}</h3>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-ink-muted">{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- About --------------------------------- */

export function About() {
  return (
    <section id="about" className="scroll-mt-20 border-t border-line/60 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <span className="label-cap text-sky-400">About</span>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink sm:text-4xl">
              Identifyy
            </h2>
            <p className="mt-4 text-ink-muted">
              A 100% browser-local tool to find, inspect, and clean invisible Unicode characters
              in CSV, TXT, Excel, and Access files — no upload, no server, no tracking.
            </p>
            <div className="mt-8 space-y-3 text-sm text-ink-muted">
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-sky-400" />
                <span>Built by <b>Vinut Shreedhar Naik</b></span>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 text-sky-400">✉</span>
                <a
                  href="mailto:vinutnaik53@gmail.com"
                  className="hover:text-sky-400 underline underline-offset-2"
                >
                  vinutnaik53@gmail.com
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 text-sky-400">in</span>
                <a
                  href="https://www.linkedin.com/in/vinut-naik-329543358/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-sky-400 underline underline-offset-2"
                >
                  LinkedIn
                </a>
              </div>
              <div className="flex items-center gap-2">
                <span className="h-4 w-4 text-sky-400">github</span>
                <a
                  href="https://github.com/vinut007/"
                  target="_blank"
                  rel="noreferrer"
                  className="hover:text-sky-400 underline underline-offset-2"
                >
                  GitHub
                </a>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-line bg-surface-raised p-6">
            <div className="flex items-center gap-2 mb-4">
              <span className="h-5 w-5 rounded-full bg-yellow-400/20 text-yellow-500 flex items-center justify-center">
                <span className="text-[10px] font-bold">V</span>
              </span>
              <div>
                <h3 className="text-base font-bold text-ink">Vinut Shreedhar Naik</h3>
                <p className="text-xs text-ink-faint">Developer · Identifyy</p>
              </div>
            </div>
            <p className="text-sm text-ink-muted mb-6">
              Everything in this app runs inside your browser tab. Your files never leave your
              machine, so you can safely inspect sensitive exports, spreadsheets, and data dumps.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-500">
              <Lock className="h-4 w-4" />
              Processed locally in your browser
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* --------------------------------- Footer -------------------------------- */

export function Footer() {
  return (
    <footer className="border-t border-line py-10">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 sm:flex-row sm:px-6">
        <div className="flex items-center gap-2 text-sm font-bold text-ink">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-gradient-to-br from-sky-400 to-sky-600 text-white">
            <ScanLine className="h-4 w-4" />
          </span>
          Identifyy
        </div>
        <p className="text-xs text-ink-faint">
          Local-first Unicode data-quality tool · React · TypeScript · Vite · SheetJS · Papa Parse
        </p>
        <div className="flex items-center gap-4 text-xs text-ink-muted">
          <a href="#features" className="hover:text-sky-400">Features</a>
          <a href="#about" className="hover:text-sky-400">About</a>
          <a href="#privacy" className="hover:text-sky-400">Privacy</a>
          <a href="#reference" className="hover:text-sky-400">Reference</a>
        </div>
      </div>
    </footer>
  );
}

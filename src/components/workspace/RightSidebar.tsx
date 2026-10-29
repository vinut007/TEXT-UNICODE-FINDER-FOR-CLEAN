import { useMemo, useState } from 'react';
import {
  ArrowUpDown,
  Ban,
  CheckCircle2,
  Copy,
  ExternalLink,
  EyeOff,
  Info,
  Link as LinkIcon,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import { useStore } from '@/store/useAnalysisStore';
import { useFilteredFindings } from './data';
import { copyText, distinctUnitCount } from './ops';
import { Badge, Spinner } from '@/components/ui/Badge';
import { Tabs } from '@/components/ui/Tabs';
import { HIGHLIGHT_CLASS } from '@/lib/engine/unit-index';
import { categoryLabel, getCategoryCode, getCategoryLabel } from '@/lib/engine/scan';
import { severityLabel, locationOf, displayChar } from '@/lib/engine/export';
import type { AnalysisResult, CharFinding, Location } from '@/types/analysis';
import { isGridFileType } from '@/types/analysis';
import { cn, toCodePointHex, unicodeRefUrl } from '@/lib/utils';

type SortKey = 'count' | 'category' | 'codepoint' | 'location';

export function RightSidebar({ result }: { result: AnalysisResult }) {
  const inspectorView = useStore((s) => s.inspectorView);
  const setInspectorView = useStore((s) => s.setInspectorView);
  const findings = useFilteredFindings(result);
  const selectedKey = useStore((s) => s.selectedKey);
  const selectedLocationId = useStore((s) => s.selectedLocationId);
  const ignored = useStore((s) => s.ignoredKeys);
  const allowed = useStore((s) => s.allowedKeys);
  const cleaning = useStore((s) => s.cleaning);

  const selected = useMemo(
    () =>
      result.findings.find((f) => f.key === selectedKey) ??
      findings.find((f) => f.key === selectedKey) ??
      null,
    [result.findings, findings, selectedKey],
  );

  return (
    <div className="flex h-full min-h-0 flex-col bg-surface-raised">
      <div className="shrink-0 border-b border-line px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-1.5 text-[13px] font-extrabold tracking-tight text-ink">
            <Sparkles className="h-3.5 w-3.5 text-yellow-400" />
            Character Inspector
          </h2>
          <Badge tone="sky">{findings.length} shown</Badge>
        </div>
        <div className="mt-2.5">
          <Tabs
            size="sm"
            className="w-full"
            items={[
              { value: 'inspector', label: 'Inspector' },
              { value: 'recommendations', label: 'Recommendations' },
            ]}
            value={inspectorView}
            onChange={setInspectorView}
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-3">
        {inspectorView === 'inspector' ? (
          cleaning ? (
            <div className="grid place-items-center gap-3 py-16 text-center text-sm text-ink-muted">
              <Spinner className="h-6 w-6 text-sky-400" />
              Re-analyzing cleaned file…
            </div>
          ) : selected ? (
            <InspectorCard
              finding={selected}
              result={result}
              location={
                selected.locations.find((l) => l.id === selectedLocationId) ??
                selected.locations[0]
              }
              isIgnored={ignored.includes(selected.key)}
              isAllowed={allowed.includes(selected.key)}
            />
          ) : (
            <FindingsList result={result} findings={findings} />
          )
        ) : (
          <RecommendationsTable result={result} findings={findings} />
        )}
      </div>
    </div>
  );
}

/* ------------------------------ findings list ----------------------------- */

function FindingsList({
  result,
  findings,
}: {
  result: AnalysisResult;
  findings: CharFinding[];
}) {
  const selectFinding = useStore((s) => s.selectFinding);
  const inspectedCell = useStore((s) => s.inspectedCell);

  if (findings.length === 0) {
    return (
      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-center">
        <CheckCircle2 className="mx-auto h-6 w-6 text-emerald-500" />
        <p className="mt-2 text-sm font-bold text-emerald-500">No suspicious characters</p>
        <p className="mt-1 text-xs text-ink-muted">
          Everything matches the current filters — this file looks clean.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] leading-relaxed text-ink-faint">
        Select a highlighted character in the preview, or pick a finding below.
        {isGridFileType(result.fileType) && inspectedCell ? (
          <span className="mt-2 block rounded-lg border border-line bg-surface px-3 py-2 text-ink-muted">
            Inspected cell:{' '}
            <span className="font-mono font-semibold text-sky-400">
              {inspectedCell.sheet}!{inspectedCell.row}:{inspectedCell.col}
            </span>
          </span>
        ) : null}
      </p>
      <ul className="space-y-1.5">
        {findings.slice(0, 120).map((f) => (
          <li key={f.key}>
            <button
              onClick={() => {
                const loc = f.locations[0];
                if (loc) selectFinding(f.key, loc);
              }}
              className={cn(
                'flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface px-2.5 py-2 text-left transition-all hover:border-sky-500/50 hover:bg-sky-500/[0.06]',
                f.severity === 'recommended' && 'border-l-2 border-l-yellow-400',
                f.severity === 'review' && 'border-l-2 border-l-orange-400',
              )}
            >
              <span
                className={cn(
                  'grid h-8 w-8 shrink-0 place-items-center rounded-md font-mono text-base',
                  'bg-surface-raised ring-1 ring-inset ring-line',
                )}
              >
                <span className={cn('hl !cursor-pointer', HIGHLIGHT_CLASS[f.category])}>
                  {displayChar(f)}
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[11px] font-bold text-ink">{f.name}</span>
                <span className="block font-mono text-[10px] text-ink-faint">
                  {toCodePointHex(f.codePoint)} · {categoryLabel(f.category)}
                </span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-mono text-[13px] font-bold text-yellow-500">
                  {f.count.toLocaleString()}
                </span>
                <span className="block text-[9px] text-ink-faint">occurrences</span>
              </span>
            </button>
          </li>
        ))}
      </ul>
      {findings.length > 120 ? (
        <p className="text-center text-[11px] text-ink-faint">
          Showing 120 of {findings.length} — use the Recommendations tab to sort everything.
        </p>
      ) : null}
    </div>
  );
}

/* ------------------------------ inspector card ---------------------------- */

function InspectorCard({
  finding: f,
  result,
  location,
  isIgnored,
  isAllowed,
}: {
  finding: CharFinding;
  result: AnalysisResult;
  location: Location | undefined;
  isIgnored: boolean;
  isAllowed: boolean;
}) {
  const selectFinding = useStore((s) => s.selectFinding);
  const ignoreFinding = useStore((s) => s.ignoreFinding);
  const allowFinding = useStore((s) => s.allowFinding);
  const unignoreFinding = useStore((s) => s.unignoreFinding);
  const showToast = useStore((s) => s.showToast);

  const suggestion = f.suggestion;
  const preview = buildPreview(f);

  const doCopy = async (text: string, label: string) => {
    await copyText(text);
    showToast('success', `${label} copied.`);
  };

  return (
    <div className="space-y-3">
      {/* character header */}
      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'grid h-14 w-14 shrink-0 place-items-center rounded-lg bg-surface-raised font-mono text-2xl ring-1 ring-inset ring-line',
            )}
          >
            <span className={cn('hl !cursor-default', HIGHLIGHT_CLASS[f.category])}>
              {displayChar(f)}
            </span>
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge tone={f.severity === 'recommended' ? 'yellow' : f.severity === 'review' ? 'orange' : 'zinc'}>
                {severityLabel(f.severity)}
              </Badge>
              <Badge tone="sky">{categoryLabel(f.category)}</Badge>
              {isAllowed ? <Badge tone="green">Allowed</Badge> : null}
              {isIgnored ? <Badge tone="violet">Ignored</Badge> : null}
            </div>
            <h3 className="mt-1.5 text-[13px] font-extrabold leading-snug text-ink">{f.name}</h3>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-muted">
              <span className="font-mono">{toCodePointHex(f.codePoint)}</span>
              <span>·</span>
              <span>{getCategoryLabel(f.codePoint)}</span>
            </div>
          </div>
        </div>

        <dl className="mt-3 space-y-1.5 text-[11px]">
          <Row label="Character">
            <code className="hl whitespace-pre font-mono !cursor-default" style={{ boxShadow: 'none' }}>
              {f.isSequence ? f.char : f.char}
            </code>
            <span className="text-ink-faint"> (visible: {displayChar(f)})</span>
          </Row>
          <Row label="Position">
            {location ? (
              <span className="text-ink">{locationOf(location, result.fileType)}</span>
            ) : (
              <span className="text-ink-faint">—</span>
            )}
            {location?.fieldCharPos !== undefined ? (
              <span className="text-ink-faint"> · char position {location.fieldCharPos}</span>
            ) : null}
            {location?.filePos !== undefined ? (
              <span className="text-ink-faint"> · file position {location.filePos}</span>
            ) : null}
          </Row>
          <Row label="Occurrences">
            <span className="font-mono font-bold text-yellow-500">
              {f.count.toLocaleString()}
            </span>
            <span className="text-ink-faint">
              {' '}
              in {distinctUnitCount(f).toLocaleString()}{' '}
              {result.fileType === 'csv' ? 'cells' : isGridFileType(result.fileType) ? 'cells' : 'lines'}
              {f.locationsTruncated ? ' (sampled)' : ''}
            </span>
          </Row>
          {location?.context ? (
            <Row label="Context">
              <span className="break-all font-mono text-ink-muted">…{location.context}…</span>
            </Row>
          ) : null}
        </dl>
      </div>

      {/* recommendation */}
      <div className="rounded-xl border border-yellow-400/40 bg-yellow-400/[0.07] p-3">
        <div className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-yellow-500">
          <ShieldCheck className="h-3.5 w-3.5" />
          Suggested replacement
        </div>
        {suggestion ? (
          <div className="mt-1.5 text-[12px] font-semibold text-ink">
            {suggestion.char === '' ? (
              <span className="text-rose-500">Remove the character entirely</span>
            ) : (
              <>
                Replace with{' '}
                <code className="rounded bg-surface px-1.5 py-0.5 font-mono">
                  {suggestion.char === ' ' ? 'SPACE (U+0020)' : suggestion.char}
                </code>
              </>
            )}
          </div>
        ) : (
          <div className="mt-1.5 text-[12px] font-semibold text-orange-500">No action needed</div>
        )}
        <p className="mt-1.5 text-[11px] leading-relaxed text-ink-muted">{f.description}</p>

        {/* before / after impact preview */}
        {suggestion ? (
          <div className="mt-2.5 space-y-1 rounded-lg border border-line bg-surface p-2">
            <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
              Impact preview
            </div>
            <div className="flex items-start gap-2 text-[11px]">
              <span className="w-14 shrink-0 text-ink-faint">Before</span>
              <span className="min-w-0 break-all font-mono text-ink">
                {preview ? preview.before : displayChar(f)}
              </span>
            </div>
            <div className="flex items-start gap-2 text-[11px]">
              <span className="w-14 shrink-0 text-ink-faint">After</span>
              <span className="min-w-0 break-all font-mono text-emerald-500">
                {preview ? preview.after : suggestion?.char || '(removed)'}
              </span>
            </div>
            <div className="text-[10px] text-ink-faint">
              {f.count.toLocaleString()} occurrence{f.count === 1 ? '' : 's'} affected
              {f.locationsTruncated ? ' (location list sampled)' : ''}
            </div>
          </div>
        ) : (
          <div className="mt-2 flex gap-2 rounded-lg border border-orange-400/30 bg-orange-400/10 p-2 text-[11px] leading-relaxed text-orange-500">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            <span>
              Mojibake is an encoding problem, not a character problem — automatic replacement
              could corrupt data. Re-save the original source as UTF-8 instead.
            </span>
          </div>
        )}
      </div>

      {/* references */}
      <div className="rounded-xl border border-line bg-surface p-3">
        <div className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
          Unicode reference
        </div>
        <div className="mt-1.5 flex flex-wrap gap-2">
          <a
            href={unicodeRefUrl(f.codePoint)}
            target="_blank"
            rel="noreferrer"
            className="btn-ghost !py-1.5 !text-[11px]"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            {toCodePointHex(f.codePoint)}
          </a>
          {suggestion && suggestion.codePoint !== undefined ? (
            <a
              href={unicodeRefUrl(suggestion.codePoint)}
              target="_blank"
              rel="noreferrer"
              className="btn-ghost !py-1.5 !text-[11px]"
            >
              <LinkIcon className="h-3.5 w-3.5" />
              {toCodePointHex(suggestion.codePoint)}
            </a>
          ) : null}
        </div>
      </div>

      {/* actions */}
      <div className="space-y-2">
        <div className="grid grid-cols-3 gap-1.5">
          <button className="btn-ghost !py-1.5 !text-[11px]" onClick={() => doCopy(f.char, 'Character')}>
            <Copy className="h-3.5 w-3.5" /> Copy char
          </button>
          <button
            className="btn-ghost !py-1.5 !text-[11px]"
            onClick={() => doCopy(toCodePointHex(f.codePoint), 'Code point')}
          >
            <Copy className="h-3.5 w-3.5" /> Code point
          </button>
          <button className="btn-ghost !py-1.5 !text-[11px]" onClick={() => doCopy(f.name, 'Name')}>
            <Copy className="h-3.5 w-3.5" /> Name
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          <button
            className="btn-ghost !py-1.5 !text-[11px]"
            onClick={() => {
              if (isIgnored) {
                unignoreFinding(f.key);
                showToast('info', `${f.name} is visible again.`);
              } else {
                ignoreFinding(f.key);
                showToast('info', `${f.name} ignored. Restore it from the left panel.`);
              }
            }}
          >
            <EyeOff className="h-3.5 w-3.5" />
            {isIgnored ? 'Stop ignoring' : 'Ignore type'}
          </button>
          <button
            className="btn-ghost !py-1.5 !text-[11px]"
            onClick={() => {
              if (isAllowed) {
                unignoreFinding(f.key);
                showToast('info', `Removed ${f.name} from the allowed list.`);
              } else {
                allowFinding(f.key);
                showToast('success', `${f.name} marked as allowed — it will be kept as-is.`);
              }
            }}
          >
            <Ban className="h-3.5 w-3.5" />
            {isAllowed ? 'Un-allow' : 'Add to allowed'}
          </button>
        </div>

        {location ? (
          <button
            className="btn-ghost w-full !py-1.5 !text-[11px]"
            onClick={() => selectFinding(f.key, location)}
          >
            Re-center preview on this location
          </button>
        ) : null}
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-2">
      <dt className="w-24 shrink-0 font-semibold text-ink-faint">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}

function buildPreview(f: CharFinding): { before: string; after: string } | null {
  const ctx = f.locations[0]?.context;
  if (ctx && ctx.includes(f.char)) {
    const to = f.suggestion?.char ?? '';
    return {
      before: ctx.replace(f.char, `<${displayChar(f)}>`),
      after: ctx.replace(f.char, to === '' ? '' : to),
    };
  }
  return null;
}

/* --------------------------- recommendations --------------------------- */

function RecommendationsTable({
  result,
  findings,
}: {
  result: AnalysisResult;
  findings: CharFinding[];
}) {
  const selectFinding = useStore((s) => s.selectFinding);
  const [sortKey, setSortKey] = useState<SortKey>('count');
  const [dir, setDir] = useState<1 | -1>(-1);
  const [sevFilter, setSevFilter] = useState<'all' | 'recommended' | 'review' | 'none'>('all');

  const sorted = useMemo(() => {
    const list = findings.filter((f) => sevFilter === 'all' || f.severity === sevFilter);
    const cmp = (a: CharFinding, b: CharFinding): number => {
      switch (sortKey) {
        case 'count':
          return a.count - b.count;
        case 'category':
          return a.category.localeCompare(b.category) || a.codePoint - b.codePoint;
        case 'codepoint':
          return a.codePoint - b.codePoint;
        case 'location': {
          const la = a.locations[0];
          const lb = b.locations[0];
          return String(la?.line ?? la?.dataRow ?? la?.cell ?? '').localeCompare(
            String(lb?.line ?? lb?.dataRow ?? lb?.cell ?? ''),
          );
        }
      }
    };
    return [...list].sort((x, y) => cmp(x, y) * dir);
  }, [findings, sortKey, dir, sevFilter]);

  const counts = useMemo(() => ({
    recommended: findings.filter((f) => f.severity === 'recommended').length,
    review: findings.filter((f) => f.severity === 'review').length,
    none: findings.filter((f) => f.severity === 'none').length,
  }), [findings]);

  const th = (key: SortKey, label: string, className?: string) => (
    <th className={cn('px-2 py-2 text-left font-semibold', className)}>
      <button
        className="flex items-center gap-1 uppercase tracking-wider hover:text-sky-400"
        onClick={() => {
          if (sortKey === key) setDir((d) => (d === 1 ? -1 : 1));
          else {
            setSortKey(key);
            setDir(key === 'count' ? -1 : 1);
          }
        }}
        title={`Sort by ${label}`}
      >
        {label}
        <ArrowUpDown className={cn('h-3 w-3', sortKey === key && 'text-sky-400')} />
      </button>
    </th>
  );

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap gap-1.5">
        {(
          [
            ['all', `All (${findings.length})`],
            ['recommended', `Recommended fixes (${counts.recommended})`],
            ['review', `Review required (${counts.review})`],
            ['none', `No action needed (${counts.none})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setSevFilter(value)}
            className={cn(
              'rounded-md border px-2 py-1 text-[10px] font-semibold transition-colors',
              sevFilter === value
                ? 'border-sky-500/60 bg-sky-500/15 text-sky-400'
                : 'border-line text-ink-muted hover:text-ink',
            )}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-lg border border-line">
        <div className="max-h-[520px] overflow-auto">
          <table className="w-full min-w-[520px] text-[11px]">
            <thead className="sticky top-0 z-10 bg-surface-raised text-ink-faint shadow-[0_1px_0_0_rgb(var(--line))]">
              <tr>
                <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider">Char</th>
                {th('codepoint', 'Unicode')}
                {th('category', 'Category')}
                {th('location', 'Location')}
                {th('count', 'Occur.', 'text-right')}
                <th className="px-2 py-2 text-left font-semibold uppercase tracking-wider">
                  Recommendation
                </th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((f) => {
                const loc = f.locations[0];
                return (
                  <tr
                    key={f.key}
                    onClick={() => loc && selectFinding(f.key, loc)}
                    className={cn(
                      'cursor-pointer border-t border-line/70 transition-colors hover:bg-sky-500/[0.07]',
                      f.severity === 'recommended' && 'bg-yellow-400/[0.04]',
                    )}
                  >
                    <td className="px-2 py-1.5">
                      <span className={cn('hl font-mono', HIGHLIGHT_CLASS[f.category])}>
                        {displayChar(f)}
                      </span>
                    </td>
                    <td className="px-2 py-1.5">
                      <a
                        href={unicodeRefUrl(f.codePoint)}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="font-mono font-semibold text-sky-400 underline decoration-sky-400/30 underline-offset-2 hover:decoration-sky-400"
                      >
                        {toCodePointHex(f.codePoint)}
                      </a>
                    </td>
                    <td className="px-2 py-1.5 text-ink-muted">{categoryLabel(f.category)}</td>
                    <td className="px-2 py-1.5 text-ink-muted">
                      {loc ? locationOf(loc, result.fileType) : '—'}
                    </td>
                    <td className="px-2 py-1.5 text-right font-mono font-bold text-yellow-500">
                      {f.count.toLocaleString()}
                    </td>
                    <td className="px-2 py-1.5">
                      <span
                        className={cn(
                          f.severity === 'recommended' && 'font-semibold text-emerald-500',
                          f.severity === 'review' && 'text-orange-500',
                          f.severity === 'none' && 'text-ink-faint',
                        )}
                      >
                        {f.suggestion?.label ?? 'No action needed'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {sorted.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-ink-faint">
                    No findings match these filters.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <p className="text-[10px] leading-relaxed text-ink-faint">
        Sorting: occurrence count, category, code point or location. Severity filters mirror the
        three recommendation buckets. Non-ASCII letters are reported for visibility but marked{' '}
        <em>no action needed</em> — legitimate international text is never treated as an error.
      </p>
    </div>
  );
}

import { Hash, Layers, ShieldCheck, Space, EyeOff, Binary } from 'lucide-react';
import type { AnalysisResult } from '@/types/analysis';
import { formatNumber } from '@/lib/utils';
import { useStore } from '@/store/useAnalysisStore';
import { cn } from '@/lib/utils';

interface CardProps {
  label: string;
  value: string | number;
  hint?: string;
  tone?: 'yellow' | 'sky' | 'rose' | 'violet' | 'emerald' | 'orange';
  icon: React.ComponentType<{ className?: string }>;
}

const TONES: Record<NonNullable<CardProps['tone']>, { wrap: string; text: string }> = {
  yellow: { wrap: 'border-yellow-400/30 bg-yellow-400/[0.06]', text: 'text-yellow-500' },
  sky: { wrap: 'border-sky-500/30 bg-sky-500/[0.06]', text: 'text-sky-400' },
  rose: { wrap: 'border-rose-500/30 bg-rose-500/[0.06]', text: 'text-rose-500' },
  violet: { wrap: 'border-violet-500/30 bg-violet-500/[0.06]', text: 'text-violet-500' },
  emerald: { wrap: 'border-emerald-500/30 bg-emerald-500/[0.06]', text: 'text-emerald-500' },
  orange: { wrap: 'border-orange-500/30 bg-orange-500/[0.06]', text: 'text-orange-500' },
};

function StatCard({ label, value, hint, icon: Icon, tone = 'yellow' }: CardProps) {
  const t = TONES[tone];
  return (
    <div className={cn('rounded-xl border p-3', t.wrap)}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-wider text-ink-faint">
          {label}
        </span>
        <Icon className={cn('h-3.5 w-3.5', t.text)} />
      </div>
      <p className={cn('mt-1.5 font-mono text-xl font-extrabold leading-none', t.text)}>
        {value}
      </p>
      {hint ? <p className="mt-1 text-[10px] text-ink-faint">{hint}</p> : null}
    </div>
  );
}

export function SummaryCards({ result }: { result: AnalysisResult }) {
  const ignored = useStore((s) => s.ignoredKeys);
  const appliedCount = useStore((s) => s.appliedCount);
  const s = result.stats;

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      <StatCard
        label="Characters scanned"
        value={formatNumber(s.totalCodePoints)}
        hint="Unicode code points"
        icon={Hash}
        tone="sky"
      />
      <StatCard
        label="Non-ASCII"
        value={formatNumber(s.nonAsciiCount)}
        hint={`${formatNumber(s.uniqueSuspicious)} unique suspicious`}
        icon={Binary}
        tone="rose"
      />
      <StatCard
        label="Unicode whitespace"
        value={formatNumber(s.unicodeWhitespaceCount)}
        hint="NBSP, thin space, ideographic…"
        icon={Space}
        tone="yellow"
      />
      <StatCard
        label="Invisible chars"
        value={formatNumber(s.invisibleCount)}
        hint="ZWSP, ZWJ, word joiner…"
        icon={EyeOff}
        tone="violet"
      />
      <StatCard
        label="Control chars"
        value={formatNumber(s.controlCount)}
        hint="C0 / C1 / DEL"
        icon={ShieldCheck}
        tone="orange"
      />
      <StatCard
        label={appliedCount > 0 ? 'Replacements applied' : 'Mojibake patterns'}
        value={formatNumber(appliedCount > 0 ? appliedCount : s.mojibakeCount)}
        hint={
          appliedCount > 0
            ? `${ignored.length} type${ignored.length === 1 ? '' : 's'} hidden`
            : 'Suspected encoding damage'
        }
        icon={Layers}
        tone={appliedCount > 0 ? 'emerald' : 'yellow'}
      />
    </div>
  );
}

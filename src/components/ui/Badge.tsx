import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Tone = 'sky' | 'yellow' | 'zinc' | 'rose' | 'violet' | 'orange' | 'green';

const TONES: Record<Tone, string> = {
  sky: 'bg-sky-500/12 text-sky-500 ring-sky-500/30',
  yellow: 'bg-yellow-400/15 text-yellow-500 ring-yellow-400/30',
  zinc: 'bg-slate-500/12 text-ink-muted ring-slate-500/30',
  rose: 'bg-rose-500/12 text-rose-500 ring-rose-500/30',
  violet: 'bg-violet-500/12 text-violet-500 ring-violet-500/30',
  orange: 'bg-orange-500/12 text-orange-500 ring-orange-500/30',
  green: 'bg-emerald-500/12 text-emerald-500 ring-emerald-500/30',
};

export function Badge({
  children,
  tone = 'zinc',
  className,
  title,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  title?: string;
}) {
  return (
    <span
      title={title}
      className={cn(
        'inline-flex items-center gap-1 rounded-md px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent',
        className,
      )}
      role="status"
      aria-label="Loading"
    />
  );
}

import { cn } from '@/lib/utils';

export interface TabItem<T extends string> {
  value: T;
  label: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export function Tabs<T extends string>({
  items,
  value,
  onChange,
  className,
  size = 'md',
}: {
  items: TabItem<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
  size?: 'sm' | 'md';
}) {
  return (
    <div
      role="tablist"
      className={cn(
        'inline-flex items-center gap-1 rounded-lg border border-line bg-surface p-1',
        className,
      )}
    >
      {items.map((it) => {
        const active = it.value === value;
        return (
          <button
            key={it.value}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(it.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-md font-semibold transition-all',
              size === 'sm' ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs',
              active
                ? 'bg-sky-500 text-white shadow-[0_2px_10px_-4px_rgba(56,189,248,.8)]'
                : 'text-ink-muted hover:text-ink hover:bg-surface-overlay',
            )}
          >
            {it.icon}
            {it.label}
            {it.badge}
          </button>
        );
      })}
    </div>
  );
}

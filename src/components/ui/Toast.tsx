import { useEffect } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useStore } from '@/store/useAnalysisStore';
import { cn } from '@/lib/utils';

const TOAST_DURATION = 4000;

export function Toast() {
  const toast = useStore((s) => s.toast);
  const dismiss = useStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast) return;
    const id = window.setTimeout(dismiss, TOAST_DURATION);
    return () => window.clearTimeout(id);
  }, [toast, dismiss]);

  if (!toast) return null;

  const tone =
    toast.kind === 'success'
      ? { wrap: 'border-emerald-500/50 bg-emerald-500/15', icon: CheckCircle2, iconCls: 'text-emerald-500' }
      : toast.kind === 'error'
        ? { wrap: 'border-rose-500/50 bg-rose-500/15', icon: XCircle, iconCls: 'text-rose-500' }
        : { wrap: 'border-sky-500/50 bg-sky-500/15', icon: Info, iconCls: 'text-sky-400' };

  const Icon = tone.icon;

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        'pointer-events-auto fixed bottom-4 left-1/2 z-[100] flex max-w-[90vw] -translate-x-1/2 items-center gap-2.5 rounded-xl border px-4 py-2.5 shadow-lg shadow-black/40 backdrop-blur animate-fade-up',
        tone.wrap,
      )}
    >
      <Icon className={cn('h-4 w-4 shrink-0', tone.iconCls)} />
      <p className="text-[12px] font-semibold text-ink">{toast.message}</p>
      <button
        onClick={dismiss}
        aria-label="Dismiss"
        className="ml-1 shrink-0 rounded p-0.5 text-ink-faint transition-colors hover:text-ink"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

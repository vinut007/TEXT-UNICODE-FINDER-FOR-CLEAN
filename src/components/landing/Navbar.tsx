import { useEffect, useState } from 'react';
import { Moon, Sun, ScanSearch } from 'lucide-react';
import { useStore } from '@/store/useAnalysisStore';

const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#about', label: 'About' },
  { href: '#reference', label: 'Character Reference' },
  { href: '#how-it-works', label: 'How It Works' },
  { href: '#privacy', label: 'Privacy' },
];

export function Navbar({ onReset }: { onReset?: () => void }) {
  const theme = useStore((s) => s.theme);
  const setTheme = useStore((s) => s.setTheme);
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-40 transition-all duration-300 ${
        scrolled
          ? 'border-b border-line bg-surface/85 backdrop-blur-md'
          : 'border-b border-transparent'
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <button
          onClick={onReset}
          className="group flex items-center gap-2.5"
          aria-label="Identifyy home"
        >
          <span className="relative grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-glow transition-transform group-hover:scale-105">
            <ScanSearch className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-yellow-400 ring-2 ring-surface-raised" />
          </span>
          <span className="text-[15px] font-extrabold tracking-tight text-ink">
            Unicode <span className="text-sky-400">Inspector</span>{' '}
            <span className="text-yellow-400">Pro</span>
          </span>
        </button>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted transition-colors hover:bg-surface-overlay hover:text-ink"
            >
              {l.label}
            </a>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="btn-ghost h-9 w-9 !p-0"
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            title={theme === 'dark' ? 'Light theme' : 'Dark theme'}
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </button>
          <button
            className="btn-primary hidden !py-2 text-xs sm:inline-flex"
            onClick={() => {
              document.getElementById('upload')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }}
          >
            Analyze a File
          </button>
          <button
            className="btn-ghost h-9 w-9 !p-0 md:hidden"
            onClick={() => setOpen((v) => !v)}
            aria-label="Toggle navigation"
            aria-expanded={open}
          >
            <span className="flex flex-col gap-[3px]">
              <span className="block h-0.5 w-4 bg-current" />
              <span className="block h-0.5 w-4 bg-current" />
              <span className="block h-0.5 w-4 bg-current" />
            </span>
          </button>
        </div>
      </div>

      {open ? (
        <div className="border-t border-line bg-surface-raised px-4 py-3 md:hidden animate-fade-in">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-lg px-3 py-2 text-sm font-medium text-ink-muted hover:bg-surface-overlay hover:text-ink"
              >
                {l.label}
              </a>
            ))}
          </div>
        </div>
      ) : null}
    </header>
  );
}

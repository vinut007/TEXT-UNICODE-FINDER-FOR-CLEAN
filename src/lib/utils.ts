import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return '—';
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let v = bytes / 1024;
  let i = 0;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v >= 100 ? Math.round(v) : v.toFixed(1)} ${units[i]}`;
}

export function formatNumber(n: number): string {
  return new Intl.NumberFormat('en-US').format(n);
}

export function formatDuration(ms: number): string {
  if (ms < 1000) return `${Math.max(1, Math.round(ms))} ms`;
  return `${(ms / 1000).toFixed(2)} s`;
}

export function toCodePointHex(cp: number): string {
  return 'U+' + cp.toString(16).toUpperCase().padStart(4, '0');
}

export function codePointToAscii(cp: number): string | null {
  if (cp === 0x09) return '\\t';
  if (cp === 0x0a) return '\\n';
  if (cp === 0x0d) return '\\r';
  if (cp === 0x00) return '\\0';
  return null;
}

export function downloadBlob(content: BlobPart, filename: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function baseName(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i > 0 ? fileName.slice(0, i) : fileName;
}

export function extName(fileName: string): string {
  const i = fileName.lastIndexOf('.');
  return i > 0 ? fileName.slice(i + 1).toLowerCase() : '';
}

export function unicodeRefUrl(cp: number): string {
  const hex = cp.toString(16).toUpperCase().padStart(4, '0');
  return `https://unicode-explorer.com/c/${hex}`;
}

export function unicodeChartUrl(cp: number): string {
  const hex = cp.toString(16).toUpperCase().padStart(4, '0').replace(/^0+/, '') || '0';
  return `https://www.unicode.org/charts/U+${hex.padStart(4, '0')}.html`;
}

/** Text-safe display of a control / format character for UI copy fields. */
export function escapeForCopy(s: string): string {
  return s;
}

export function truncateMiddle(s: string, max = 60): string {
  if (s.length <= max) return s;
  const half = Math.floor((max - 1) / 2);
  return `${s.slice(0, half)}…${s.slice(-half)}`;
}

export function columnToLetter(col: number): string {
  let n = col;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

export function letterToColumn(letters: string): number {
  let n = 0;
  for (const ch of letters.toUpperCase()) {
    n = n * 26 + (ch.charCodeAt(0) - 64);
  }
  return n;
}

export function cellRef(row: number, col: number): string {
  return `${columnToLetter(col)}${row}`;
}

export function uid(prefix = 'id'): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

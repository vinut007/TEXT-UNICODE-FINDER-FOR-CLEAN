import type { CharFinding, CleanOp } from '@/types/analysis';
import { uid, toCodePointHex } from '@/lib/utils';

/** Replace every occurrence of a finding's character in the whole document. */
export function buildReplaceAllOp(f: CharFinding): CleanOp {
  const to = f.suggestion?.char ?? '';
  return {
    id: uid('op'),
    kind: 'replace-char',
    findingKey: f.key,
    from: f.codePoint,
    fromText: f.char,
    to,
    label:
      f.suggestion?.label ??
      (to === ''
        ? `Remove ${toCodePointHex(f.codePoint)}`
        : `${toCodePointHex(f.codePoint)} → ${JSON.stringify(to)}`),
    category: f.category,
    count: f.count,
    scope: { unit: 'document' },
  };
}

/** Distinct preview units (cells/lines) a finding touches — from stored locations. */
export function distinctUnitCount(f: CharFinding): number {
  const set = new Set<string>();
  for (const l of f.locations) {
    if (l.sheet) set.add(`${l.sheet}!${l.cellRow}:${l.cellCol}`);
    else if (l.record !== undefined) set.add(`${l.record}:${l.fieldIndex}`);
    else if (l.line !== undefined) set.add(`L${l.line}`);
  }
  return set.size;
}

export function canReplace(f: CharFinding): boolean {
  // Mojibake is an encoding problem — never auto-rewritten from a pattern match.
  return f.category !== 'mojibake' && !!f.suggestion;
}

export async function copyText(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    ta.remove();
  }
}

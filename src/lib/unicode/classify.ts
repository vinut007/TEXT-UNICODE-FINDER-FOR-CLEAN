import type { FindingCategory, ReplacementSuggestion, Severity } from '@/types/analysis';
import { getCodePointName } from './names';

export interface Classified {
  category: FindingCategory | null;
  severity: Severity;
  suggestion?: ReplacementSuggestion;
  description: string;
}

export const WHITESPACE_CPS = new Set<number>([
  0x0009, 0x000a, 0x000d, 0x0020, 0x00a0, 0x1680, 0x202f, 0x205f, 0x3000, 0x2028, 0x2029,
]);
for (let cp = 0x2000; cp <= 0x200a; cp++) WHITESPACE_CPS.add(cp);

export const ASCII_WHITESPACE = new Set<number>([0x0009, 0x000a, 0x000d]);

const SPACES_TO_NORMALIZE = new Set<number>([
  0x00a0, 0x1680, 0x202f, 0x205f, 0x3000, 0x2007,
]);
for (let cp = 0x2000; cp <= 0x200a; cp++) SPACES_TO_NORMALIZE.add(cp);

const INVISIBLE = new Set<number>([
  0x200b, 0x200c, 0x200d, 0x2060, 0x00ad, 0x200e, 0x200f,
  0x202a, 0x202b, 0x202c, 0x202d, 0x202e,
  0x2066, 0x2067, 0x2068, 0x2069,
  0x206a, 0x206b, 0x206c, 0x206d, 0x206e, 0x206f,
  0x061c, 0x180e, 0x115f, 0x1160, 0x3164, 0xffa0,
  0x2028, 0x2029, // line/paragraph separators: invisible line breaks
]);
for (let cp = 0xfe00; cp <= 0xfe0f; cp++) INVISIBLE.add(cp);

function isControl(cp: number): boolean {
  return (cp >= 0x0000 && cp <= 0x0008) || (cp >= 0x000b && cp <= 0x000c) ||
    (cp >= 0x000e && cp <= 0x001f) || cp === 0x007f || (cp >= 0x0080 && cp <= 0x009f);
}

const NAME_DESC: Record<number, string> = {
  0x00a0: 'This character looks like a normal space but can behave differently in text processing, matching, and data-cleaning workflows.',
  0x202f: 'A narrow space that looks like a normal space; frequently breaks string matching, sorting, and split operations.',
  0x2007: 'A figure space sized like a digit; often introduced by word processors and rarely intended in data.',
  0x3000: 'A full-width space used in CJK typography; often accidental when copied from East-Asian text.',
  0x1680: 'Ogham space mark — rarely intentional outside Ogham text.',
  0x200b: 'Invisible character with zero width. Commonly pasted from web pages and often breaks exact string matching.',
  0x200c: 'Zero-width non-joiner: controls ligature behavior, invisible in most editors.',
  0x200d: 'Zero-width joiner: invisible; used in emoji sequences and some scripts — verify before removing.',
  0x2060: 'Word joiner: prevents line breaks at its position, invisible in rendered text.',
  0xfeff: 'Byte order mark. As a leading character it marks UTF-8/UTF-16 encoding; inside text it is an invisible zero-width character.',
  0x00ad: 'Soft hyphen: invisible unless a line breaks there; can corrupt exact matching.',
  0x200e: 'Left-to-right mark: invisible directional control, often embedded in pasted text.',
  0x200f: 'Right-to-left mark: invisible directional control, often embedded in pasted text.',
  0x202e: 'Right-to-left override — invisible control sometimes used to disguise file names or content.',
  0x202d: 'Left-to-right override — invisible control affecting text direction.',
  0x001b: 'Escape control character; rarely valid in structured data.',
};

export function isCodePointInvisible(cp: number): boolean {
  return INVISIBLE.has(cp);
}

export function isCodePointWhitespace(cp: number): boolean {
  return WHITESPACE_CPS.has(cp);
}

export function isCodePointControl(cp: number): boolean {
  return isControl(cp);
}

/**
 * Classify a single code point. Returns `category: null` when the code point
 * is ordinary ASCII content that should not be reported.
 */
export function classifyCodePoint(
  cp: number,
  opts: { asciiWhitespace: boolean },
): Classified {
  const name = getCodePointName(cp);

  // ---- control characters (C0 / C1 / DEL) ----
  if (isControl(cp)) {
    if (ASCII_WHITESPACE.has(cp)) {
      if (!opts.asciiWhitespace) {
        return {
          category: null,
          severity: 'none',
          description: 'Ordinary ASCII whitespace.',
        };
      }
      return {
        category: 'whitespace',
        severity: 'none',
        description: `${name}. ASCII control whitespace that most tools handle correctly.`,
      };
    }
    return {
      category: 'control',
      severity: 'recommended',
      suggestion: { char: '', label: 'Remove control character' },
      description: `${name} is a control character with no visible representation and can break parsers and spreadsheets.`,
    };
  }

  // ---- BOM ----
  if (cp === 0xfeff) {
    return {
      category: 'bom',
      severity: 'review',
      suggestion: { char: '', label: 'Remove embedded BOM' },
      description: NAME_DESC[0xfeff]!,
    };
  }

  // ---- invisible / format characters ----
  if (INVISIBLE.has(cp)) {
    const isZwjFamily = cp === 0x200d || cp === 0x200c;
    return {
      category: 'invisible',
      severity: 'review',
      suggestion: { char: '', label: isZwjFamily ? 'Review and remove' : 'Remove invisible character' },
      description: NAME_DESC[cp] ?? `${name} has no visible rendering and can silently corrupt matching, joins, and exports.`,
    };
  }

  // ---- Unicode whitespace ----
  if (WHITESPACE_CPS.has(cp)) {
    if (SPACES_TO_NORMALIZE.has(cp)) {
      return {
        category: 'whitespace',
        severity: 'recommended',
        suggestion: { char: ' ', codePoint: 0x20, label: 'Replace with U+0020 SPACE' },
        description:
          NAME_DESC[cp] ??
          `${name} behaves like a space but is not U+0020; it often breaks splitting, searching and trimming.`,
      };
    }
    return {
      category: 'whitespace',
      severity: 'review',
      suggestion: { char: ' ', codePoint: 0x20, label: 'Replace with U+0020 SPACE' },
      description: NAME_DESC[cp] ?? `${name} is a Unicode space separator that may not be handled as expected.`,
    };
  }

  // ---- every other non-ASCII code point ----
  if (cp > 0x7f) {
    const punct = suggestAsciiPunctuation(cp);
    if (punct) {
      return {
        category: 'non-ascii',
        severity: 'review',
        suggestion: punct,
        description: `${name} is a typographic character commonly introduced by word processors. Replace it only if downstream systems require pure ASCII.`,
      };
    }
    return {
      category: 'non-ascii',
      severity: 'none',
      description: `${name} is legitimate non-ASCII content (international text, symbols or scripts). No action is usually needed.`,
    };
  }

  return { category: null, severity: 'none', description: '' };
}

/** Optional ASCII replacements for typographic characters. */
function suggestAsciiPunctuation(cp: number): ReplacementSuggestion | undefined {
  switch (cp) {
    case 0x2018:
    case 0x2019:
    case 0x201a:
    case 0x201b:
    case 0x02bc:
      return { char: "'", codePoint: 0x27, label: "Replace with ASCII apostrophe (U+0027)" };
    case 0x201c:
    case 0x201d:
    case 0x201e:
    case 0x201f:
      return { char: '"', codePoint: 0x22, label: 'Replace with ASCII quotation mark (U+0022)' };
    case 0x2013:
    case 0x2014:
    case 0x2212:
      return { char: '-', codePoint: 0x2d, label: 'Replace with ASCII hyphen (U+002D)' };
    case 0x2026:
      return { char: '...', label: 'Replace with three ASCII periods' };
    case 0x00a0:
      return { char: ' ', codePoint: 0x20, label: 'Replace with U+0020 SPACE' };
    case 0x00d7:
      return { char: 'x', codePoint: 0x78, label: 'Replace with letter x' };
    case 0x00ae:
      return { char: '(R)', label: 'Replace with (R)' };
    case 0x00a9:
      return { char: '(C)', label: 'Replace with (C)' };
    case 0x2122:
      return { char: '(TM)', label: 'Replace with (TM)' };
    default:
      return undefined;
  }
}

/* ---------------- mojibake heuristics ---------------- */

/** Characters produced by decoding UTF-8 bytes as Windows-1252 punctuation. */
const CP1252_TAIL = new Set<number>([
  0x20ac, 0x201a, 0x0192, 0x201e, 0x2026, 0x2020, 0x2021, 0x02c6,
  0x2030, 0x0160, 0x2039, 0x0152, 0x017d, 0x2018, 0x2019, 0x201c,
  0x201d, 0x2022, 0x2013, 0x2014, 0x02dc, 0x2122, 0x0161, 0x203a,
  0x0153, 0x017e, 0x0178,
]);

/** True when `a` (a Latin-1 high char) followed by `b` looks like mojibake. */
export function isMojibakePair(a: number, b: number): boolean {
  // Classic: UTF-8 lead byte decoded as Latin-1 (U+00C2–U+00DF) + continuation (U+0080–U+00BF)
  if (a >= 0x00c2 && a <= 0x00df && b >= 0x0080 && b <= 0x00bf) return true;
  // Lead byte U+00C0–U+00FF followed by a continuation-range char (covers Ã©, Ã¼ …)
  if (a >= 0x00c0 && a <= 0x00ff && b >= 0x0080 && b <= 0x00bf) return true;
  // Windows-1252 tail characters (€‚„…†‡ˆ‰Š‹ŒœžŸ ' ' " " • – — ˜ ™) after a high lead char
  if (a >= 0x00c0 && a <= 0x00ff && CP1252_TAIL.has(b)) return true;
  return false;
}

export interface MojibakeMatch {
  /** UTF-16 offset of the first character. */
  start: number;
  /** UTF-16 length of the whole sequence. */
  length: number;
  text: string;
}

/**
 * Heuristic scan for classic mojibake sequences such as `Ã©`, `â€™`,
 * `â€œ`, `ï»¿`. These are warnings — never auto-rewritten.
 */
export function findMojibake(text: string, limit = 200000): MojibakeMatch[] {
  const out: MojibakeMatch[] = [];
  const chars = [...text];
  let utf16 = 0;
  for (let i = 0; i < chars.length && out.length < limit; i++) {
    const a = chars[i].codePointAt(0)!;
    const next = chars[i + 1];
    if (next !== undefined && a > 0x7f) {
      const b = next.codePointAt(0)!;
      if (isMojibakePair(a, b)) {
        const third = chars[i + 2];
        let len = chars[i].length + next.length;
        let textLen = 2;
        // extend to a third character when it also fits the pattern (ï»¿, â€™ …)
        if (third !== undefined) {
          const c = third.codePointAt(0)!;
          if (
            (a === 0x00ef && b === 0x00bb && c === 0x00bf) ||
            (CP1252_TAIL.has(c) && a >= 0x00c0) ||
            (c >= 0x0080 && c <= 0x00bf && b >= 0x00c0)
          ) {
            len += third.length;
            textLen = 3;
          }
        }
        out.push({
          start: utf16,
          length: len,
          text: chars.slice(i, i + textLen).join(''),
        });
        utf16 += len;
        i += textLen - 1;
        continue;
      }
    }
    utf16 += chars[i].length;
  }
  return out;
}

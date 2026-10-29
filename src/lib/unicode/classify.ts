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

    // Accented letters decompose to an ASCII base via NFD (e.g. ü → u, é → e, å → a).
    const base = asciiBase(cp);
    if (base) {
      const baseCp = base.codePointAt(0)!;
      return {
        category: 'non-ascii',
        severity: 'review',
        suggestion: {
          char: base,
          codePoint: baseCp,
          label: `Replace with '${base}' (U+${baseCp.toString(16).toUpperCase().padStart(4, '0')})`,
        },
        description: `${name} is an accented character. Replace with ASCII base '${base}' if downstream systems require pure ASCII.`,
      };
    }

    // Characters that don't NFD-decompose to a single ASCII base but have
    // common ASCII replacements (e.g. Æ → AE, ß → ss, œ → oe).
    const multi = suggestMultiAscii(cp);
    if (multi) {
      return {
        category: 'non-ascii',
        severity: 'review',
        suggestion: multi,
        description: `${name} is an accented character. Replace with '${multi.char}' if downstream systems require pure ASCII.`,
      };
    }

    // Emoji -> text equivalents.
    const emoji = suggestEmoji(cp);
    if (emoji) {
      return {
        category: 'non-ascii',
        severity: 'review',
        suggestion: emoji,
        description: `${name} is an emoji. Replace with '${emoji.char}' if downstream systems require pure ASCII.`,
      };
    }

    // Symbol -> ASCII equivalents.
    const symbol = suggestSymbol(cp);
    if (symbol) {
      return {
        category: 'non-ascii',
        severity: 'review',
        suggestion: symbol,
        description: `${name} is a symbol. Replace with '${symbol.char}' if downstream systems require pure ASCII.`,
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

/** Strip accents/diacritics via NFD decomposition; return ASCII base char if one exists. */
function asciiBase(cp: number): string | null {
  const decomposed = String.fromCodePoint(cp).normalize('NFD');
  let base = '';
  let i = 0;
  while (i < decomposed.length) {
    const dcp = decomposed.codePointAt(i)!;
    // combining diacritical marks U+0300–U+036F
    if (dcp >= 0x0300 && dcp <= 0x036f) {
      i += dcp > 0xffff ? 2 : 1;
      continue;
    }
    base += decomposed[i];
    i += dcp > 0xffff ? 2 : 1;
  }
  if (base.length === 1 && base.codePointAt(0)! < 0x80) return base;
  return null;
}

/** Multi-character ASCII replacements for characters that don't NFD-decompose cleanly. */
function suggestMultiAscii(cp: number): ReplacementSuggestion | null {
  const map: Record<number, { char: string; label: string }> = {
    0x00c6: { char: 'AE', label: "Replace with 'AE' (Æ)" },
    0x00e6: { char: 'ae', label: "Replace with 'ae' (æ)" },
    0x00df: { char: 'ss', label: "Replace with 'ss' (ß)" },
    0x0152: { char: 'OE', label: "Replace with 'OE' (Œ)" },
    0x0153: { char: 'oe', label: "Replace with 'oe' (œ)" },
    0x00de: { char: 'Th', label: "Replace with 'Th' (Þ)" },
    0x00fe: { char: 'th', label: "Replace with 'th' (þ)" },
  };
  const entry = map[cp];
  if (!entry) return null;
  return {
    char: entry.char,
    codePoint: entry.char.codePointAt(0)!,
    label: entry.label,
  };
}

/** Common emoji -> text equivalents. */
const EMOJI_MAP: Record<number, { char: string; label: string }> = {
  0x1f600: { char: ':D', label: "Replace with ':D' (grinning face)" },
  0x1f603: { char: ':D', label: "Replace with ':D' (grinning face with big eyes)" },
  0x1f604: { char: ':D', label: "Replace with ':D' (grinning face with smiling eyes)" },
  0x1f601: { char: ':D', label: "Replace with ':D' (beaming face with smiling eyes)" },
  0x1f606: { char: ':D', label: "Replace with ':D' (grinning squinting face)" },
  0x1f923: { char: ':D', label: "Replace with ':D' (rolling on the floor laughing)" },
  0x1f602: { char: ':D', label: "Replace with ':D' (face with tears of joy)" },
  0x1f642: { char: ':)', label: "Replace with ':)' (slightly smiling face)" },
  0x1f643: { char: ':)', label: "Replace with ':)' (upside-down face)" },
  0x1f609: { char: ';)', label: "Replace with ';)' (winking face)" },
  0x1f60a: { char: ':)', label: "Replace with ':)' (smiling face with smiling eyes)" },
  0x1f60d: { char: ':*', label: "Replace with ':*' (face blowing a kiss)" },
  0x1f618: { char: ':*', label: "Replace with ':*' (face blowing a kiss)" },
  0x1f617: { char: ':p', label: "Replace with ':p' (face with tongue)" },
  0x1f61b: { char: ':p', label: "Replace with ':p' (face with stuck-out tongue & winking eye)" },
  0x1f61c: { char: ':p', label: "Replace with ':p' (face with stuck-out tongue & closed eyes)" },
  0x1f61d: { char: ':p', label: "Replace with ':p' (face with stuck-out tongue & tightly-closed eyes)" },
  0x1f60b: { char: ':)', label: "Replace with ':)' (smiling face with halo)" },
  0x1f60f: { char: ':*', label: "Replace with ':*' (smiling face with heart-shaped eyes)" },
  0x1f619: { char: ':*', label: "Replace with ':*' (kissing face with smiling eyes)" },
  0x1f61a: { char: ':*', label: "Replace with ':*' (kissing face with closed eyes)" },
  0x1f61e: { char: ':p', label: "Replace with ':p' (disappointed face)" },
  0x1f620: { char: ':(', label: "Replace with ':(' (angry face)" },
  0x1f621: { char: ':(', label: "Replace with ':(' (pouting face)" },
  0x1f622: { char: ':(', label: "Replace with ':(' (crying face)" },
  0x1f623: { char: ':(', label: "Replace with ':(' (disappointed but relieved face)" },
  0x1f624: { char: ':(', label: "Replace with ':(' (weary face)" },
  0x1f625: { char: ':(', label: "Replace with ':(' (pensive face)" },
  0x1f626: { char: ":'(", label: "Replace with ':(' (face screaming in fear)" },
  0x1f627: { char: ':(', label: "Replace with ':(' (weary face)" },
  0x1f628: { char: ':-O', label: "Replace with ':-O' (fearful face)" },
  0x1f629: { char: ':-O', label: "Replace with ':-O' (astonished face)" },
  0x1f62a: { char: '-_-', label: "Replace with '-_-' (face with raised eyebrow)" },
  0x1f62b: { char: ':(', label: "Replace with ':(' (tired face)" },
  0x1f62c: { char: '-_-', label: "Replace with '-_-' (face with look of triumph)" },
  0x1f62d: { char: ':(', label: "Replace with ':(' (loudly crying face)" },
  0x1f62e: { char: ':(', label: "Replace with ':(' (hushed face)" },
  0x1f62f: { char: ':-O', label: "Replace with ':-O' (face with open mouth & cold sweat)" },
  0x1f630: { char: '-_-', label: "Replace with '-_-' (face screaming in fear)" },
  0x1f631: { char: ':-O', label: "Replace with ':-O' (flushed face)" },
  0x1f632: { char: ':(', label: "Replace with ':(' (sleeping face)" },
  0x1f633: { char: ':(', label: "Replace with ':(' (dizzy face)" },
  0x1f634: { char: '-_-', label: "Replace with '-_-' (face without mouth)" },
  0x1f635: { char: '-_-', label: "Replace with '-_-' (face with diagonal mouth)" },
  0x1f636: { char: '-_-', label: "Replace with '-_-' (face with steam from nose)" },
  0x1f637: { char: ':D', label: "Replace with ':D' (face with open mouth)" },
  0x1f638: { char: ':-O', label: "Replace with ':-O' (face with open mouth & cold sweat)" },
  0x1f639: { char: ':O', label: "Replace with ':O' (hushed face)" },
  0x1f63a: { char: ':)', label: "Replace with ':)' (face with open mouth & smiling eyes)" },
  0x1f63b: { char: ':)', label: "Replace with ':)' (smiling face with open mouth & tightly-closed eyes)" },
  0x1f63c: { char: ':)', label: "Replace with ':)' (smiling face with halo)" },
  0x1f63d: { char: ':(', label: "Replace with ':(' (sleeping face)" },
  0x1f63e: { char: ':-O', label: "Replace with ':-O' (face with open mouth & cold sweat)" },
  0x1f63f: { char: ':-O', label: "Replace with ':-O' (face with open mouth & smiling eyes)" },
  0x1f640: { char: ':D', label: "Replace with ':D' (face with open mouth & tightly-closed eyes)" },
  0x1f641: { char: ':-O', label: "Replace with ':-O' (face with open mouth & smiling eyes)" },
  0x1f644: { char: ':)', label: "Replace with ':)' (upside-down face)" },
  0x1f645: { char: ':-/', label: "Replace with ':-/' (face with raised eyebrow)" },
  0x1f646: { char: ':(', label: "Replace with ':(' (face with thermometer)" },
  0x1f647: { char: ':(', label: "Replace with ':(' (face with head-bandage)" },
  0x1f648: { char: ':(', label: "Replace with ':(' (nauseated face)" },
  0x1f649: { char: ':(', label: "Replace with ':(' (sneezing face)" },
  0x1f64a: { char: ':(', label: "Replace with ':(' (face with thermometer)" },
  0x1f64b: { char: 'no', label: "Replace with 'no' (person gesturing no)" },
  0x1f64c: { char: 'ok', label: "Replace with 'ok' (person gesturing ok)" },
  0x1f64d: { char: ':(', label: "Replace with ':(' (person bowing)" },
  0x1f64e: { char: ':-/', label: "Replace with ':-/' (person gesturing no)" },
  0x1f64f: { char: ':)', label: "Replace with ':)' (person gesturing ok)" },
  0x1f650: { char: ':-/', label: "Replace with ':-/' (person gesturing no)" },
  0x1f90f: { char: ':D', label: "Replace with ':D' (face with hand over mouth)" },
  0x1f910: { char: ':D', label: "Replace with ':D' (face with hand over mouth)" },
  0x1f911: { char: ':)', label: "Replace with ':)' (zipper-mouth face)" },
  0x1f913: { char: ':)', label: "Replace with ':)' (money-mouth face)" },
  0x1f914: { char: ':-/', label: "Replace with ':-/' (face with thermometer)" },
  0x1f915: { char: ':(', label: "Replace with ':(' (nerd face)" },
  0x1f916: { char: ':-/', label: "Replace with ':-/' (face with monocle)" },
  0x1f917: { char: ':p', label: "Replace with ':p' (hugging face)" },
  0x1f919: { char: ':)', label: "Replace with ':)' (lion face)" },
  0x1f91c: { char: ':-/', label: "Replace with ':-/' (face with cowboy hat)" },
  0x1f91d: { char: ':-/', label: "Replace with ':-/' (clown face)" },
  0x1f91e: { char: ':(', label: "Replace with ':(' (nauseated face)" },
  0x1f920: { char: ':)', label: "Replace with ':)' (drooling face)" },
  0x1f921: { char: ':(', label: "Replace with ':(' (lying face)" },
  0x1f922: { char: ':)', label: "Replace with ':)' (face with hand over mouth)" },
  0x1f924: { char: ':)', label: "Replace with ':)' (face with cowboy hat)" },
  0x1f925: { char: ':)', label: "Replace with ':)' (clown face)" },
  0x1f926: { char: ':)', label: "Replace with ':)' (nauseated face)" },
  0x1f927: { char: ':-/', label: "Replace with ':-/' (rolling on the floor laughing)" },
  0x1f928: { char: ':)', label: "Replace with ':)' (drooling face)" },
  0x1f929: { char: ':)', label: "Replace with ':)' (lying face)" },
  0x1f92a: { char: ':)', label: "Replace with ':)' (face with hand over mouth)" },
  0x1f92b: { char: ':)', label: "Replace with ':)' (drooling face)" },
  0x1f92c: { char: ':)', label: "Replace with ':)' (lying face)" },
  0x1f92d: { char: ':-/', label: "Replace with ':-/' (face with hand over mouth)" },
  0x1f92e: { char: ':)', label: "Replace with ':)' (drooling face)" },
  0x1f92f: { char: ':)', label: "Replace with ':)' (lying face)" },
  0x1f970: { char: ':)', label: "Replace with ':)' (drooling face)" },
  0x1f971: { char: ':)', label: "Replace with ':)' (lying face)" },
  0x1f972: { char: ':-/', label: "Replace with ':-/' (face with hand over mouth)" },
  0x1f973: { char: ':)', label: "Replace with ':)' (drooling face)" },
  0x1f974: { char: ':)', label: "Replace with ':)' (lying face)" },
  0x1f975: { char: ':-/', label: "Replace with ':-/' (face with hand over mouth)" },
  0x1f976: { char: ':-/', label: "Replace with ':-/' (drooling face)" },
  0x1f977: { char: ':)', label: "Replace with ':)' (lying face)" },
  0x1f978: { char: ':)', label: "Replace with ':)' (face with hand over mouth)" },
  0x1f979: { char: ':-/', label: "Replace with ':-/' (drooling face)" },
  0x1f97a: { char: ':-/', label: "Replace with ':-/' (lying face)" },
  0x2764: { char: '<3', label: "Replace with '<3' (red heart)" },
  0x1f494: { char: '<3', label: "Replace with '<3' (blue heart)" },
  0x1f49a: { char: '<3', label: "Replace with '<3' (green heart)" },
  0x1f49b: { char: '<3', label: "Replace with '<3' (yellow heart)" },
  0x1f49c: { char: '<3', label: "Replace with '<3' (purple heart)" },
  0x1f5a4: { char: '<3', label: "Replace with '<3' (black heart)" },
  0x1f90e: { char: '<3', label: "Replace with '<3' (white heart)" },
  0x1f90d: { char: '<3', label: "Replace with '<3' (brown heart)" },
  0x1fa77: { char: '<3', label: "Replace with '<3' (heart on fire)" },
  0x1fa78: { char: '<3', label: "Replace with '<3' (mending heart)" },
  0x1f44d: { char: '(y)', label: "Replace with '(y)' (thumbs up)" },
  0x1f44e: { char: '(n)', label: "Replace with '(n)' (thumbs down)" },
  0x1f44c: { char: 'ok', label: "Replace with 'ok' (ok hand)" },
  0x1f525: { char: 'fire', label: "Replace with 'fire' (fire)" },
  0x1f4af: { char: '100', label: "Replace with '100' (hundred points)" },
  0x2728: { char: '*', label: "Replace with '*' (sparkles)" },
  0x1f389: { char: 'party', label: "Replace with 'party' (party popper)" },
  0x1f38a: { char: 'party', label: "Replace with 'party' (confetti ball)" },
  0x2b50: { char: '*', label: "Replace with '*' (star)" },
  0x1f31f: { char: '*', label: "Replace with '*' (glowing star)" },
};

export function suggestEmoji(cp: number): ReplacementSuggestion | null {
  const entry = EMOJI_MAP[cp];
  if (!entry) return null;
  return {
    char: entry.char,
    codePoint: entry.char.codePointAt(0)!,
    label: entry.label,
  };
}

/** Common symbol -> ASCII equivalents. */
const SYMBOL_MAP: Record<number, { char: string; label: string }> = {
  0x2605: { char: '*', label: "Replace with '*' (black star)" },
  0x2606: { char: '*', label: "Replace with '*' (white star)" },
  0x2192: { char: '->', label: "Replace with '->' (rightwards arrow)" },
  0x2190: { char: '<-', label: "Replace with '<-' (leftwards arrow)" },
  0x2191: { char: '^', label: "Replace with '^' (upwards arrow)" },
  0x2193: { char: 'v', label: "Replace with 'v' (downwards arrow)" },
  0x2194: { char: '<->', label: "Replace with '<->' (left right arrow)" },
  0x2260: { char: '!=', label: "Replace with '!=' (not equal to)" },
  0x2264: { char: '<=', label: "Replace with '<=' (less-than or equal to)" },
  0x2265: { char: '>=', label: "Replace with '>=' (greater-than or equal to)" },
  0x00b1: { char: '+/-', label: "Replace with '+/-' (plus-minus sign)" },
  0x00d7: { char: 'x', label: "Replace with 'x' (multiplication sign)" },
  0x00f7: { char: '/', label: "Replace with '/' (division sign)" },
  0x00a2: { char: '(c)', label: "Replace with '(c)' (cent sign)" },
  0x00a3: { char: 'GBP', label: "Replace with 'GBP' (pound sign)" },
  0x20ac: { char: 'EUR', label: "Replace with 'EUR' (euro sign)" },
  0x00a5: { char: 'JPY', label: "Replace with 'JPY' (yen sign)" },
  0x00a9: { char: '(c)', label: "Replace with '(c)' (copyright sign)" },
  0x00ae: { char: '(r)', label: "Replace with '(r)' (registered sign)" },
  0x2122: { char: '(tm)', label: "Replace with '(tm)' (trade mark sign)" },
  0x00b0: { char: 'deg', label: "Replace with 'deg' (degree sign)" },
  0x00a1: { char: '!', label: "Replace with '!' (inverted exclamation mark)" },
  0x00bf: { char: '?', label: "Replace with '?' (inverted question mark)" },
  0x2022: { char: '*', label: "Replace with '*' (bullet)" },
  0x2026: { char: '...', label: "Replace with '...' (horizontal ellipsis)" },
  0x2013: { char: '-', label: "Replace with '-' (en dash)" },
  0x2014: { char: '-', label: "Replace with '-' (em dash)" },
  0x2018: { char: "'", label: "Replace with \"'\" (left single quotation mark)" },
  0x2019: { char: "'", label: "Replace with \"'\" (right single quotation mark)" },
  0x201c: { char: '"', label: "Replace with '\"' (left double quotation mark)" },
  0x201d: { char: '"', label: "Replace with '\"' (right double quotation mark)" },
  0x00ab: { char: '<<', label: "Replace with '<<' (left-pointing double angle quotation mark)" },
  0x00bb: { char: '>>', label: "Replace with '>>' (right-pointing double angle quotation mark)" },
  0x2032: { char: "'", label: "Replace with \"'\" (prime)" },
  0x2033: { char: "\"", label: "Replace with '\"' (double prime)" },
};

export function suggestSymbol(cp: number): ReplacementSuggestion | null {
  const entry = SYMBOL_MAP[cp];
  if (!entry) return null;
  return {
    char: entry.char,
    codePoint: entry.char.codePointAt(0)!,
    label: entry.label,
  };
}

/** Recover the intended character from a mojibake sequence by re-encoding
 * the visible text as Latin-1 bytes and decoding as UTF-8.
 *
 * Example: "Ã¼" → bytes C3 BC → UTF-8 decode → "ü" → NFD base "u".
 */
export function recoverMojibake(text: string): ReplacementSuggestion | null {
  try {
    const bytes = new Uint8Array(text.length);
    for (let i = 0; i < text.length; i++) {
      const cp = text.codePointAt(i)!;
      if (cp > 0xff) return null; // not pure Latin-1
      bytes[i] = cp;
    }
    const recovered = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
    if (recovered.length === 0) return null;
    const recoveredCp = recovered.codePointAt(0)!;

    const base = asciiBase(recoveredCp);
    if (base) {
      const baseCp = base.codePointAt(0)!;
      return {
        char: base,
        codePoint: baseCp,
        label: `Replace with '${base}' (U+${baseCp.toString(16).toUpperCase().padStart(4, '0')}) — recovered from '${text}'`,
      };
    }

    return {
      char: recovered,
      codePoint: recoveredCp,
      label: `Replace with '${recovered}' (U+${recoveredCp.toString(16).toUpperCase().padStart(4, '0')}) — recovered from '${text}'`,
    };
  } catch {
    return null;
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

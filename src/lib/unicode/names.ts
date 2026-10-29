/**
 * Compact local Unicode database.
 *
 * A full UCD table would be several megabytes; this app only needs accurate
 * names for the characters that matter for data-cleaning work plus a
 * best-effort name for everything else. Strategy:
 *   1. exact names for control / whitespace / format / punctuation hot list
 *   2. full names for Basic Latin + Latin-1 Supplement
 *   3. block-based fallback name for the rest
 */

const N: Record<number, string> = {
  0x0000: 'NULL', 0x0001: 'START OF HEADING', 0x0002: 'START OF TEXT',
  0x0003: 'END OF TEXT', 0x0004: 'END OF TRANSMISSION', 0x0005: 'ENQUIRY',
  0x0006: 'ACKNOWLEDGE', 0x0007: 'BELL', 0x0008: 'BACKSPACE', 0x0009: 'CHARACTER TABULATION',
  0x000a: 'LINE FEED (LF)', 0x000b: 'LINE TABULATION', 0x000c: 'FORM FEED (FF)',
  0x000d: 'CARRIAGE RETURN (CR)', 0x000e: 'SHIFT OUT', 0x000f: 'SHIFT IN',
  0x0010: 'DATA LINK ESCAPE', 0x0011: 'DEVICE CONTROL ONE', 0x0012: 'DEVICE CONTROL TWO',
  0x0013: 'DEVICE CONTROL THREE', 0x0014: 'DEVICE CONTROL FOUR', 0x0015: 'NEGATIVE ACKNOWLEDGE',
  0x0016: 'SYNCHRONOUS IDLE', 0x0017: 'END OF TRANSMISSION BLOCK', 0x0018: 'CANCEL',
  0x0019: 'END OF MEDIUM', 0x001a: 'SUBSTITUTE', 0x001b: 'ESCAPE', 0x001c: 'FILE SEPARATOR',
  0x001d: 'GROUP SEPARATOR', 0x001e: 'RECORD SEPARATOR', 0x001f: 'UNIT SEPARATOR',
  0x007f: 'DELETE',
  0x0080: 'PAD', 0x0081: 'HOP', 0x0082: 'BREAK PERMITTED HERE', 0x0083: 'NO BREAK HERE',
  0x0084: 'INDEX', 0x0085: 'NEXT LINE (NEL)', 0x0086: 'START OF SELECTIVE EXCUSE',
  0x0087: 'END OF SELECTIVE EXCUSE', 0x0088: 'CARD REQUEST', 0x0089: 'REVERSE LINE FEED',
  0x008a: 'SINGLE SHIFT TWO', 0x008b: 'SINGLE SHIFT THREE', 0x008c: 'DEVICE CONTROL FOUR (DC4)',
  0x008d: 'NEGATIVE ACKNOWLEDGE (NAK)', 0x008e: 'SYNCHRONOUS IDLE (SYN)', 0x008f: 'END OF TRANSMISSION BLOCK (ETB)',
  0x0090: 'CANCEL (CAN)', 0x0091: 'END OF MEDIUM (EM)', 0x0092: 'SUBSTITUTE (SUB)',
  0x0093: 'ESCAPE (ESC)', 0x0094: 'FILE SEPARATOR (FS)', 0x0095: 'GROUP SEPARATOR (GS)',
  0x0096: 'RECORD SEPARATOR (RS)', 0x0097: 'UNIT SEPARATOR (US)', 0x0098: 'OPERATING SYSTEM COMMAND',
  0x0099: 'PRIVACY USE', 0x009a: 'SINGLE GRAPHIC CHARACTER INTRODUCER',
  0x009b: 'SINGLE CHARACTER INTRODUCER', 0x009c: 'STRING TERMINATOR', 0x009d: 'OPERATING SYSTEM COMMAND (OSC)',
  0x009e: 'PRIVACY MESSAGE', 0x009f: 'APPLICATION PROGRAM COMMAND',
};

// Basic Latin printable names
const BASIC = [
  'SPACE', 'EXCLAMATION MARK', 'QUOTATION MARK', 'NUMBER SIGN', 'DOLLAR SIGN', 'PERCENT SIGN',
  'AMPERSAND', 'APOSTROPHE', 'LEFT PARENTHESIS', 'RIGHT PARENTHESIS', 'ASTERISK', 'PLUS SIGN',
  'COMMA', 'HYPHEN-MINUS', 'FULL STOP', 'SOLIDUS', 'DIGIT ZERO', 'DIGIT ONE', 'DIGIT TWO',
  'DIGIT THREE', 'DIGIT FOUR', 'DIGIT FIVE', 'DIGIT SIX', 'DIGIT SEVEN', 'DIGIT EIGHT',
  'DIGIT NINE', 'COLON', 'SEMICOLON', 'LESS-THAN SIGN', 'EQUALS SIGN', 'GREATER-THAN SIGN',
  'QUESTION MARK', 'COMMERCIAL AT',
];
const PUNCT2 = [
  'LEFT SQUARE BRACKET', 'REVERSE SOLIDUS', 'RIGHT SQUARE BRACKET', 'CIRCUMFLEX ACCENT',
  'LOW LINE', 'GRAVE ACCENT',
];
const CUR = ['LEFT CURLY BRACKET', 'VERTICAL LINE', 'RIGHT CURLY BRACKET', 'TILDE'];
for (let i = 0; i < BASIC.length; i++) N[0x20 + i] = BASIC[i];
for (let i = 0; i < PUNCT2.length; i++) N[0x5b + i] = PUNCT2[i];
for (let i = 0; i < CUR.length; i++) N[0x7b + i] = CUR[i];
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
for (let i = 0; i < 26; i++) N[0x41 + i] = `LATIN CAPITAL LETTER ${LETTERS[i]}`;
for (let i = 0; i < 26; i++) N[0x61 + i] = `LATIN SMALL LETTER ${LETTERS[i]}`;
for (let i = 0; i < 10; i++) N[0x30 + i] = `DIGIT ${['ZERO','ONE','TWO','THREE','FOUR','FIVE','SIX','SEVEN','EIGHT','NINE'][i]}`;

// Latin-1 Supplement
const L1_UPPER = [
  'LATIN CAPITAL LETTER A WITH GRAVE','LATIN CAPITAL LETTER A WITH ACUTE','LATIN CAPITAL LETTER A WITH CIRCUMFLEX',
  'LATIN CAPITAL LETTER A WITH TILDE','LATIN CAPITAL LETTER A WITH DIAERESIS','LATIN CAPITAL LETTER A WITH RING ABOVE',
  'LATIN CAPITAL LETTER AE','LATIN CAPITAL LETTER C WITH CEDILLA','LATIN CAPITAL LETTER E WITH GRAVE',
  'LATIN CAPITAL LETTER E WITH ACUTE','LATIN CAPITAL LETTER E WITH CIRCUMFLEX','LATIN CAPITAL LETTER E WITH DIAERESIS',
  'LATIN CAPITAL LETTER I WITH GRAVE','LATIN CAPITAL LETTER I WITH ACUTE','LATIN CAPITAL LETTER I WITH CIRCUMFLEX',
  'LATIN CAPITAL LETTER I WITH DIAERESIS','LATIN CAPITAL LETTER ETH','LATIN CAPITAL LETTER N WITH TILDE',
  'LATIN CAPITAL LETTER O WITH GRAVE','LATIN CAPITAL LETTER O WITH ACUTE','LATIN CAPITAL LETTER O WITH CIRCUMFLEX',
  'LATIN CAPITAL LETTER O WITH TILDE','LATIN CAPITAL LETTER O WITH DIAERESIS','LATIN MULTIPLICATION SIGN',
  'LATIN CAPITAL LETTER O WITH STROKE','LATIN CAPITAL LETTER U WITH GRAVE','LATIN CAPITAL LETTER U WITH ACUTE',
  'LATIN CAPITAL LETTER U WITH CIRCUMFLEX','LATIN CAPITAL LETTER U WITH DIAERESIS','LATIN CAPITAL LETTER Y WITH ACUTE',
  'LATIN CAPITAL LETTER THORN','LATIN SMALL LETTER SHARP S',
];
const L1_SYMS: [number, string][] = [
  [0x00a0,'NO-BREAK SPACE'],[0x00a1,'INVERTED EXCLAMATION MARK'],[0x00a2,'CENT SIGN'],[0x00a3,'POUND SIGN'],
  [0x00a4,'CURRENCY SIGN'],[0x00a5,'YEN SIGN'],[0x00a6,'BROKEN BAR'],[0x00a7,'SECTION SIGN'],
  [0x00a8,'DIAERESIS'],[0x00a9,'COPYRIGHT SIGN'],[0x00aa,'FEMININE ORDINAL INDICATOR'],
  [0x00ab,'LEFT-POINTING DOUBLE ANGLE QUOTATION MARK'],[0x00ac,'NOT SIGN'],[0x00ad,'SOFT HYPHEN'],
  [0x00ae,'REGISTERED SIGN'],[0x00af,'MACRON'],[0x00b0,'DEGREE SIGN'],[0x00b1,'PLUS-MINUS SIGN'],
  [0x00b2,'SUPERSCRIPT TWO'],[0x00b3,'SUPERSCRIPT THREE'],[0x00b4,'ACUTE ACCENT'],[0x00b5,'MICRO SIGN'],
  [0x00b6,'PILCROW SIGN'],[0x00b7,'MIDDLE DOT'],[0x00b8,'CEDILLA'],[0x00b9,'SUPERSCRIPT ONE'],
  [0x00ba,'MASCULINE ORDINAL INDICATOR'],[0x00bb,'RIGHT-POINTING DOUBLE ANGLE QUOTATION MARK'],
  [0x00bc,'VULGAR FRACTION ONE QUARTER'],[0x00bd,'VULGAR FRACTION ONE HALF'],[0x00be,'VULGAR FRACTION THREE QUARTERS'],
  [0x00bf,'INVERTED QUESTION MARK'],[0x00d7,'MULTIPLICATION SIGN'],[0x00f7,'DIVISION SIGN'],
];
const L1_LOWER = [
  'LATIN SMALL LETTER A WITH GRAVE','LATIN SMALL LETTER A WITH ACUTE','LATIN SMALL LETTER A WITH CIRCUMFLEX',
  'LATIN SMALL LETTER A WITH TILDE','LATIN SMALL LETTER A WITH DIAERESIS','LATIN SMALL LETTER A WITH RING ABOVE',
  'LATIN SMALL LETTER AE','LATIN SMALL LETTER C WITH CEDILLA','LATIN SMALL LETTER E WITH GRAVE',
  'LATIN SMALL LETTER E WITH ACUTE','LATIN SMALL LETTER E WITH CIRCUMFLEX','LATIN SMALL LETTER E WITH DIAERESIS',
  'LATIN SMALL LETTER I WITH GRAVE','LATIN SMALL LETTER I WITH ACUTE','LATIN SMALL LETTER I WITH CIRCUMFLEX',
  'LATIN SMALL LETTER I WITH DIAERESIS','LATIN SMALL LETTER ETH','LATIN SMALL LETTER N WITH TILDE',
  'LATIN SMALL LETTER O WITH GRAVE','LATIN SMALL LETTER O WITH ACUTE','LATIN SMALL LETTER O WITH CIRCUMFLEX',
  'LATIN SMALL LETTER O WITH TILDE','LATIN SMALL LETTER O WITH DIAERESIS','LATIN SMALL LETTER DIVISION SIGN',
  'LATIN SMALL LETTER O WITH STROKE','LATIN SMALL LETTER U WITH GRAVE','LATIN SMALL LETTER U WITH ACUTE',
  'LATIN SMALL LETTER U WITH CIRCUMFLEX','LATIN SMALL LETTER U WITH DIAERESIS','LATIN SMALL LETTER Y WITH ACUTE',
  'LATIN SMALL LETTER THORN','LATIN SMALL LETTER Y WITH DIAERESIS',
];
for (let i = 0; i < 32; i++) N[0xc0 + i] = L1_UPPER[i];
for (let i = 0; i < 32; i++) N[0xe0 + i] = L1_LOWER[i];
for (const [cp, name] of L1_SYMS) N[cp] = name;

// Hot list: everything the inspector is built around
Object.assign(N, {
  0x1680: 'OGHAM SPACE MARK',
  0x2000: 'EN QUAD', 0x2001: 'EM QUAD', 0x2002: 'EN SPACE', 0x2003: 'EM SPACE',
  0x2004: 'THREE-PER-EM SPACE', 0x2005: 'FOUR-PER-EM SPACE', 0x2006: 'SIX-PER-EM SPACE',
  0x2007: 'FIGURE SPACE', 0x2008: 'PUNCTUATION SPACE', 0x2009: 'THIN SPACE', 0x200a: 'HAIR SPACE',
  0x200b: 'ZERO WIDTH SPACE', 0x200c: 'ZERO WIDTH NON-JOINER', 0x200d: 'ZERO WIDTH JOINER',
  0x200e: 'LEFT-TO-RIGHT MARK', 0x200f: 'RIGHT-TO-LEFT MARK',
  0x2010: 'HYPHEN', 0x2011: 'NON-BREAKING HYPHEN', 0x2012: 'FIGURE DASH', 0x2013: 'EN DASH',
  0x2014: 'EM DASH', 0x2015: 'HORIZONTAL BAR', 0x2016: 'DOUBLE VERTICAL LINE',
  0x2018: 'LEFT SINGLE QUOTATION MARK', 0x2019: 'RIGHT SINGLE QUOTATION MARK',
  0x201a: 'SINGLE LOW-9 QUOTATION MARK', 0x201b: 'SINGLE HIGH-REVERSED-9 QUOTATION MARK',
  0x201c: 'LEFT DOUBLE QUOTATION MARK', 0x201d: 'RIGHT DOUBLE QUOTATION MARK',
  0x201e: 'DOUBLE LOW-9 QUOTATION MARK', 0x201f: 'DOUBLE HIGH-REVERSED-9 QUOTATION MARK',
  0x2020: 'DAGGER', 0x2021: 'DOUBLE DAGGER', 0x2022: 'BULLET', 0x2026: 'HORIZONTAL ELLIPSIS',
  0x2028: 'LINE SEPARATOR', 0x2029: 'PARAGRAPH SEPARATOR',
  0x202a: 'LEFT-TO-RIGHT EMBEDDING', 0x202b: 'RIGHT-TO-LEFT EMBEDDING',
  0x202c: 'POP DIRECTIONAL FORMATTING', 0x202d: 'LEFT-TO-RIGHT OVERRIDE',
  0x202e: 'RIGHT-TO-LEFT OVERRIDE', 0x202f: 'NARROW NO-BREAK SPACE',
  0x2030: 'PER MILLE SIGN', 0x2039: 'SINGLE LEFT-POINTING ANGLE QUOTATION MARK',
  0x203a: 'SINGLE RIGHT-POINTING ANGLE QUOTATION MARK',
  0x203b: 'REFERENCE MARK', 0x203c: 'DOUBLE EXCLAMATION MARK',
  0x2044: 'FRACTION SLASH', 0x205f: 'MEDIUM MATHEMATICAL SPACE', 0x2060: 'WORD JOINER',
  0x2061: 'FUNCTION APPLICATION', 0x2062: 'INVISIBLE TIMES', 0x2063: 'INVISIBLE SEPARATOR',
  0x2064: 'INVISIBLE PLUS',
  0x2066: 'LEFT-TO-RIGHT ISOLATE', 0x2067: 'RIGHT-TO-LEFT ISOLATE',
  0x2068: 'FIRST STRONG ISOLATE', 0x2069: 'POP DIRECTIONAL ISOLATE',
  0x206a: 'INHIBIT SYMMETRIC SWAPPING', 0x206b: 'ACTIVATE SYMMETRIC SWAPPING',
  0x206c: 'INHIBIT ARABIC FORM SHAPING', 0x206d: 'ACTIVATE ARABIC FORM SHAPING',
  0x206e: 'NATIONAL DIGIT SHAPES', 0x206f: 'NOMINAL DIGIT SHAPES',
  0x20a0: 'EURO-CURRENCY SIGN', 0x20ac: 'EURO SIGN', 0x20bd: 'RUBLE SIGN', 0x20b9: 'INDIAN RUPEE SIGN',
  0x2116: 'NUMERO SIGN', 0x2122: 'TRADE MARK SIGN', 0x2139: 'INFORMATION SOURCE',
  0x2190: 'LEFTWARDS ARROW', 0x2192: 'RIGHTWARDS ARROW', 0x2194: 'LEFT RIGHT ARROW',
  0x2212: 'MINUS SIGN', 0x2215: 'DIVISION SLASH', 0x2248: 'ALMOST EQUAL TO',
  0x2260: 'NOT EQUAL TO', 0x2264: 'LESS-THAN OR EQUAL TO', 0x2265: 'GREATER-THAN OR EQUAL TO',
  0x22ef: 'MIDLINE HORIZONTAL ELLIPSIS',
  0x25a0: 'BLACK SQUARE', 0x25cf: 'BLACK CIRCLE', 0x2610: 'BALLOT BOX',
  0x2611: 'BALLOT BOX WITH CHECK', 0x2713: 'CHECK MARK', 0x2714: 'HEAVY CHECK MARK',
  0x2717: 'BALLOT X', 0x2718: 'HEAVY BALLOT X', 0x2764: 'HEAVY BLACK HEART',
  0x3000: 'IDEOGRAPHIC SPACE', 0x3001: 'IDEOGRAPHIC COMMA', 0x3002: 'IDEOGRAPHIC FULL STOP',
  0xfeff: 'ZERO WIDTH NO-BREAK SPACE', 0xfffd: 'REPLACEMENT CHARACTER',
  0xfe00: 'VARIATION SELECTOR-1', 0xfe0e: 'VARIATION SELECTOR-15', 0xfe0f: 'VARIATION SELECTOR-16',
  0x00ad: 'SOFT HYPHEN',
  0xe0100: 'VARIATION SELECTOR-17',
});

/* ---------- block-based fallback ---------- */
interface Block { start: number; end: number; name: string }
const BLOCKS: Block[] = [
  { start: 0x0080, end: 0x00ff, name: 'LATIN-1 SUPPLEMENT' },
  { start: 0x0100, end: 0x017f, name: 'LATIN EXTENDED-A' },
  { start: 0x0180, end: 0x024f, name: 'LATIN EXTENDED-B' },
  { start: 0x0250, end: 0x02af, name: 'IPA EXTENSIONS' },
  { start: 0x02b0, end: 0x02ff, name: 'SPACING MODIFIER LETTERS' },
  { start: 0x0300, end: 0x036f, name: 'COMBINING DIACRITICAL MARKS' },
  { start: 0x0370, end: 0x03ff, name: 'GREEK AND COPTIC' },
  { start: 0x0400, end: 0x04ff, name: 'CYRILLIC' },
  { start: 0x0500, end: 0x052f, name: 'CYRILLIC SUPPLEMENT' },
  { start: 0x0530, end: 0x058f, name: 'ARMENIAN' },
  { start: 0x0590, end: 0x05ff, name: 'HEBREW' },
  { start: 0x0600, end: 0x06ff, name: 'ARABIC' },
  { start: 0x0700, end: 0x074f, name: 'SYRIAC' },
  { start: 0x0780, end: 0x07bf, name: 'THAANA' },
  { start: 0x0900, end: 0x097f, name: 'DEVANAGARI' },
  { start: 0x0980, end: 0x09ff, name: 'BENGALI' },
  { start: 0x0e00, end: 0x0e7f, name: 'THAI' },
  { start: 0x0e80, end: 0x0eff, name: 'LAO' },
  { start: 0x10a0, end: 0x10ff, name: 'GEORGIAN' },
  { start: 0x1100, end: 0x11ff, name: 'HANGUL JAMO' },
  { start: 0x1e00, end: 0x1eff, name: 'LATIN EXTENDED ADDITIONAL' },
  { start: 0x1f00, end: 0x1fff, name: 'GREEK EXTENDED' },
  { start: 0x2000, end: 0x206f, name: 'GENERAL PUNCTUATION' },
  { start: 0x2070, end: 0x209f, name: 'SUPERSCRIPTS AND SUBSCRIPTS' },
  { start: 0x20a0, end: 0x20cf, name: 'CURRENCY SYMBOLS' },
  { start: 0x2100, end: 0x214f, name: 'LETTERLIKE SYMBOLS' },
  { start: 0x2150, end: 0x218f, name: 'NUMBER FORMS' },
  { start: 0x2190, end: 0x21ff, name: 'ARROWS' },
  { start: 0x2200, end: 0x22ff, name: 'MATHEMATICAL OPERATORS' },
  { start: 0x2300, end: 0x23ff, name: 'MISCELLANEOUS TECHNICAL' },
  { start: 0x2400, end: 0x243f, name: 'CONTROL PICTURES' },
  { start: 0x2460, end: 0x24ff, name: 'ENCLOSED ALPHANUMERICS' },
  { start: 0x2500, end: 0x257f, name: 'BOX DRAWING' },
  { start: 0x2580, end: 0x259f, name: 'BLOCK ELEMENTS' },
  { start: 0x25a0, end: 0x25ff, name: 'GEOMETRIC SHAPES' },
  { start: 0x2600, end: 0x26ff, name: 'MISCELLANEOUS SYMBOLS' },
  { start: 0x2700, end: 0x27bf, name: 'DINGBATS' },
  { start: 0x27c0, end: 0x27ef, name: 'MISCELLANEOUS MATHEMATICAL SYMBOLS-A' },
  { start: 0x2800, end: 0x28ff, name: 'BRAILLE PATTERN' },
  { start: 0x2e80, end: 0x2eff, name: 'CJK RADICALS SUPPLEMENT' },
  { start: 0x3000, end: 0x303f, name: 'CJK SYMBOLS AND PUNCTUATION' },
  { start: 0x3040, end: 0x309f, name: 'HIRAGANA' },
  { start: 0x30a0, end: 0x30ff, name: 'KATAKANA' },
  { start: 0x3400, end: 0x4dbf, name: 'CJK UNIFIED IDEOGRAPHS EXTENSION A' },
  { start: 0x4e00, end: 0x9fff, name: 'CJK UNIFIED IDEOGRAPHS' },
  { start: 0xa720, end: 0xa7ff, name: 'LATIN EXTENDED-D' },
  { start: 0xa800, end: 0xa82f, name: 'SYLLABIC SYLLABLES' },
  { start: 0xac00, end: 0xd7af, name: 'HANGUL SYLLABLES' },
  { start: 0xf900, end: 0xfaff, name: 'CJK COMPATIBILITY IDEOGRAPHS' },
  { start: 0xfb00, end: 0xfb06, name: 'LATIN LIGATURES' },
  { start: 0xfe00, end: 0xfe0f, name: 'VARIATION SELECTORS' },
  { start: 0xfe30, end: 0xfe4f, name: 'CJK COMPATIBILITY FORMS' },
  { start: 0xfe50, end: 0xfe6f, name: 'SMALL FORM VARIANTS' },
  { start: 0xfe70, end: 0xfeff, name: 'ARABIC PRESENTATION FORMS-B' },
  { start: 0xff00, end: 0xffef, name: 'HALFWIDTH AND FULLWIDTH FORMS' },
  { start: 0xfff0, end: 0xffff, name: 'SPECIALS' },
  { start: 0x10000, end: 0x1007f, name: 'LINEAR B SYLLABARY' },
  { start: 0x10300, end: 0x1034f, name: 'OLD ITALIC' },
  { start: 0x1d400, end: 0x1d7ff, name: 'MATHEMATICAL ALPHANUMERIC SYMBOLS' },
  { start: 0x1f300, end: 0x1f5ff, name: 'MISCELLANEOUS SYMBOLS AND PICTOGRAPHS' },
  { start: 0x1f600, end: 0x1f64f, name: 'EMOTICONS' },
  { start: 0x1f680, end: 0x1f6ff, name: 'TRANSPORT AND MAP SYMBOLS' },
  { start: 0x1f900, end: 0x1f9ff, name: 'SUPPLEMENTAL SYMBOLS AND PICTOGRAPHS' },
  { start: 0x20000, end: 0x2a6df, name: 'CJK UNIFIED IDEOGRAPHS EXTENSION B' },
  { start: 0xe0100, end: 0xe01ef, name: 'VARIATION SELECTORS SUPPLEMENT' },
];

function blockName(cp: number): string | null {
  for (const b of BLOCKS) if (cp >= b.start && cp <= b.end) return b.name;
  if (cp >= 0xd800 && cp <= 0xdfff) return 'SURROGATE';
  if (cp >= 0xe000 && cp <= 0xf8ff) return 'PRIVATE USE';
  return null;
}

/** Exact or best-effort Unicode name for a code point. */
export function getCodePointName(cp: number): string {
  const exact = N[cp];
  if (exact) return exact;
  const block = blockName(cp);
  const hex = cp.toString(16).toUpperCase().padStart(4, '0');
  return block ? `${block} CHARACTER ${hex}` : `UNICODE CHARACTER U+${hex}`;
}

export function hasExactName(cp: number): boolean {
  return N[cp] !== undefined;
}

/* ---------- general category (compact BMP-oriented table) ---------- */
export type CategoryCode =
  | 'Cc' | 'Cf' | 'Co' | 'Cn' | 'Cs' | 'Ll' | 'Lm' | 'Lo' | 'Lt' | 'Lu'
  | 'Mc' | 'Me' | 'Mn' | 'Nd' | 'Nl' | 'No' | 'Pc' | 'Pd' | 'Pe' | 'Pf'
  | 'Pi' | 'Po' | 'Ps' | 'Sc' | 'Sk' | 'Sm' | 'So' | 'Zl' | 'Zp' | 'Zs';

export const CATEGORY_LABELS: Record<CategoryCode, string> = {
  Cc: 'Control', Cf: 'Format', Co: 'Private Use', Cn: 'Unassigned', Cs: 'Surrogate',
  Ll: 'Lowercase Letter', Lm: 'Modifier Letter', Lo: 'Other Letter', Lt: 'Titlecase Letter',
  Lu: 'Uppercase Letter', Mc: 'Spacing Mark', Me: 'Enclosing Mark', Mn: 'Nonspacing Mark',
  Nd: 'Decimal Number', Nl: 'Letter Number', No: 'Other Number', Pc: 'Connector Punctuation',
  Pd: 'Dash Punctuation', Pe: 'Close Punctuation', Pf: 'Final Punctuation',
  Pi: 'Initial Punctuation', Po: 'Other Punctuation', Ps: 'Open Punctuation',
  Sc: 'Currency Symbol', Sk: 'Modifier Symbol', Sm: 'Math Symbol', So: 'Other Symbol',
  Zl: 'Line Separator', Zp: 'Paragraph Separator', Zs: 'Space Separator',
};

interface CatRange { s: number; e: number; c: CategoryCode }
// Sorted by start; covers the ranges that matter for data-quality work.
const CAT_RANGES: CatRange[] = [
  { s: 0x0000, e: 0x001f, c: 'Cc' }, { s: 0x0020, e: 0x0020, c: 'Zs' },
  { s: 0x0021, e: 0x0023, c: 'Po' }, { s: 0x0024, e: 0x0024, c: 'Sc' },
  { s: 0x0025, e: 0x0025, c: 'Po' }, { s: 0x0026, e: 0x0026, c: 'Po' },
  { s: 0x0027, e: 0x0027, c: 'Po' }, { s: 0x0028, e: 0x0028, c: 'Ps' },
  { s: 0x0029, e: 0x0029, c: 'Pe' }, { s: 0x002a, e: 0x002a, c: 'Po' },
  { s: 0x002b, e: 0x002b, c: 'Sm' }, { s: 0x002c, e: 0x002c, c: 'Po' },
  { s: 0x002d, e: 0x002d, c: 'Pd' }, { s: 0x002e, e: 0x002f, c: 'Po' },
  { s: 0x0030, e: 0x0039, c: 'Nd' }, { s: 0x003a, e: 0x003b, c: 'Po' },
  { s: 0x003c, e: 0x003e, c: 'Sm' }, { s: 0x003f, e: 0x0040, c: 'Po' },
  { s: 0x0041, e: 0x005a, c: 'Lu' }, { s: 0x005b, e: 0x005b, c: 'Ps' },
  { s: 0x005c, e: 0x005c, c: 'Po' }, { s: 0x005d, e: 0x005d, c: 'Pe' },
  { s: 0x005e, e: 0x005e, c: 'Sk' }, { s: 0x005f, e: 0x005f, c: 'Pc' },
  { s: 0x0060, e: 0x0060, c: 'Sk' }, { s: 0x0061, e: 0x007a, c: 'Ll' },
  { s: 0x007b, e: 0x007b, c: 'Ps' }, { s: 0x007c, e: 0x007c, c: 'Sm' },
  { s: 0x007d, e: 0x007d, c: 'Pe' }, { s: 0x007e, e: 0x007e, c: 'Sm' },
  { s: 0x007f, e: 0x009f, c: 'Cc' },
  { s: 0x00a0, e: 0x00a0, c: 'Zs' }, { s: 0x00a1, e: 0x00a1, c: 'Po' },
  { s: 0x00a2, e: 0x00a5, c: 'Sc' }, { s: 0x00a6, e: 0x00a6, c: 'So' },
  { s: 0x00a7, e: 0x00a7, c: 'Po' }, { s: 0x00a8, e: 0x00a8, c: 'Sk' },
  { s: 0x00a9, e: 0x00a9, c: 'So' }, { s: 0x00aa, e: 0x00aa, c: 'Lo' },
  { s: 0x00ab, e: 0x00ab, c: 'Pi' }, { s: 0x00ac, e: 0x00ac, c: 'Sm' },
  { s: 0x00ad, e: 0x00ad, c: 'Cf' }, { s: 0x00ae, e: 0x00ae, c: 'So' },
  { s: 0x00af, e: 0x00af, c: 'Sk' }, { s: 0x00b0, e: 0x00b0, c: 'So' },
  { s: 0x00b1, e: 0x00b1, c: 'Sm' }, { s: 0x00b2, e: 0x00b3, c: 'No' },
  { s: 0x00b4, e: 0x00b4, c: 'Sk' }, { s: 0x00b5, e: 0x00b5, c: 'Ll' },
  { s: 0x00b6, e: 0x00b7, c: 'Po' }, { s: 0x00b8, e: 0x00b8, c: 'Sk' },
  { s: 0x00b9, e: 0x00b9, c: 'No' }, { s: 0x00ba, e: 0x00ba, c: 'Lo' },
  { s: 0x00bb, e: 0x00bb, c: 'Pf' }, { s: 0x00bc, e: 0x00be, c: 'No' },
  { s: 0x00bf, e: 0x00bf, c: 'Po' },
  { s: 0x00c0, e: 0x00d6, c: 'Lu' }, { s: 0x00d7, e: 0x00d7, c: 'Sm' },
  { s: 0x00d8, e: 0x00de, c: 'Lu' }, { s: 0x00df, e: 0x00f6, c: 'Ll' },
  { s: 0x00f7, e: 0x00f7, c: 'Sm' }, { s: 0x00f8, e: 0x00ff, c: 'Ll' },
  { s: 0x0100, e: 0x017f, c: 'Lu' }, { s: 0x0180, e: 0x01bf, c: 'Ll' },
  { s: 0x0370, e: 0x0373, c: 'Lu' }, { s: 0x0391, e: 0x03a1, c: 'Lu' },
  { s: 0x03a3, e: 0x03ab, c: 'Lu' }, { s: 0x03b1, e: 0x03c1, c: 'Ll' },
  { s: 0x03c3, e: 0x03cb, c: 'Ll' }, { s: 0x0400, e: 0x042f, c: 'Lu' },
  { s: 0x0430, e: 0x044f, c: 'Ll' },
  { s: 0x05d0, e: 0x05ea, c: 'Lo' }, { s: 0x0600, e: 0x0605, c: 'Cf' },
  { s: 0x0621, e: 0x063a, c: 'Lo' }, { s: 0x0641, e: 0x064a, c: 'Lo' },
  { s: 0x0660, e: 0x0669, c: 'Nd' },
  { s: 0x0900, e: 0x0902, c: 'Mn' }, { s: 0x0905, e: 0x0939, c: 'Lo' },
  { s: 0x0966, e: 0x096f, c: 'Nd' },
  { s: 0x0e01, e: 0x0e3a, c: 'Lo' }, { s: 0x0e40, e: 0x0e44, c: 'Lo' },
  { s: 0x1100, e: 0x11ff, c: 'Lo' },
  { s: 0x1e00, e: 0x1eff, c: 'Lu' },
  { s: 0x2000, e: 0x200a, c: 'Zs' }, { s: 0x200b, e: 0x200f, c: 'Cf' },
  { s: 0x2010, e: 0x2015, c: 'Pd' }, { s: 0x2016, e: 0x2017, c: 'Po' },
  { s: 0x2018, e: 0x2018, c: 'Pi' }, { s: 0x2019, e: 0x201a, c: 'Pf' },
  { s: 0x201b, e: 0x201c, c: 'Pi' }, { s: 0x201d, e: 0x201e, c: 'Pf' },
  { s: 0x201f, e: 0x201f, c: 'Pi' },
  { s: 0x2020, e: 0x2022, c: 'Po' }, { s: 0x2023, e: 0x2025, c: 'Po' },
  { s: 0x2026, e: 0x2027, c: 'Po' },
  { s: 0x2028, e: 0x2028, c: 'Zl' }, { s: 0x2029, e: 0x2029, c: 'Zp' },
  { s: 0x202a, e: 0x202e, c: 'Cf' }, { s: 0x202f, e: 0x202f, c: 'Zs' },
  { s: 0x2030, e: 0x2038, c: 'Po' }, { s: 0x2039, e: 0x203a, c: 'Pi' },
  { s: 0x203b, e: 0x203e, c: 'Po' }, { s: 0x203f, e: 0x2042, c: 'Pc' },
  { s: 0x2044, e: 0x2044, c: 'Sm' }, { s: 0x2052, e: 0x2052, c: 'Sm' },
  { s: 0x2053, e: 0x205e, c: 'Po' }, { s: 0x205f, e: 0x205f, c: 'Zs' },
  { s: 0x2060, e: 0x2064, c: 'Cf' }, { s: 0x2066, e: 0x206f, c: 'Cf' },
  { s: 0x2070, e: 0x2070, c: 'No' }, { s: 0x2074, e: 0x2079, c: 'No' },
  { s: 0x20a0, e: 0x20bf, c: 'Sc' },
  { s: 0x2102, e: 0x2102, c: 'Lu' }, { s: 0x2107, e: 0x2107, c: 'Lu' },
  { s: 0x2113, e: 0x2113, c: 'Lm' }, { s: 0x2116, e: 0x2116, c: 'So' },
  { s: 0x2118, e: 0x2118, c: 'Sm' }, { s: 0x211c, e: 0x211c, c: 'Lu' },
  { s: 0x2122, e: 0x2122, c: 'So' }, { s: 0x2126, e: 0x2126, c: 'Lu' },
  { s: 0x212a, e: 0x212b, c: 'Lu' }, { s: 0x212d, e: 0x212d, c: 'Lu' },
  { s: 0x2132, e: 0x2132, c: 'Lu' }, { s: 0x2139, e: 0x2139, c: 'Lo' },
  { s: 0x213a, e: 0x213b, c: 'So' }, { s: 0x2145, e: 0x2148, c: 'Lu' },
  { s: 0x2160, e: 0x216f, c: 'Nl' }, { s: 0x2170, e: 0x217f, c: 'Nl' },
  { s: 0x2190, e: 0x2194, c: 'Sm' }, { s: 0x219a, e: 0x21ff, c: 'Sm' },
  { s: 0x2200, e: 0x22ff, c: 'Sm' },
  { s: 0x2300, e: 0x2307, c: 'So' }, { s: 0x2308, e: 0x230b, c: 'Sm' },
  { s: 0x2320, e: 0x2321, c: 'Sm' }, { s: 0x237c, e: 0x237c, c: 'Sm' },
  { s: 0x239b, e: 0x23b3, c: 'Sm' },
  { s: 0x2400, e: 0x2426, c: 'So' }, { s: 0x2440, e: 0x244a, c: 'So' },
  { s: 0x2460, e: 0x2487, c: 'No' }, { s: 0x24ea, e: 0x24ff, c: 'No' },
  { s: 0x2500, e: 0x2573, c: 'So' }, { s: 0x2580, e: 0x259f, c: 'So' },
  { s: 0x25a0, e: 0x25ff, c: 'So' }, { s: 0x2600, e: 0x27bf, c: 'So' },
  { s: 0x2800, e: 0x28ff, c: 'So' }, { s: 0x2900, e: 0x2982, c: 'Sm' },
  { s: 0x2e80, e: 0x2e99, c: 'Lo' }, { s: 0x3000, e: 0x3000, c: 'Zs' },
  { s: 0x3001, e: 0x3003, c: 'Po' }, { s: 0x3008, e: 0x3011, c: 'Ps' },
  { s: 0x3012, e: 0x3012, c: 'So' }, { s: 0x3013, e: 0x3013, c: 'So' },
  { s: 0x3014, e: 0x301f, c: 'Ps' }, { s: 0x3020, e: 0x3020, c: 'So' },
  { s: 0x3030, e: 0x3030, c: 'Pd' }, { s: 0x3036, e: 0x3037, c: 'So' },
  { s: 0x303d, e: 0x303d, c: 'Po' }, { s: 0x3041, e: 0x3096, c: 'Lo' },
  { s: 0x3099, e: 0x309a, c: 'Mn' }, { s: 0x30a1, e: 0x30fa, c: 'Lo' },
  { s: 0x30fb, e: 0x30fc, c: 'Po' }, { s: 0x4e00, e: 0x9fff, c: 'Lo' },
  { s: 0xac00, e: 0xd7a3, c: 'Lo' }, { s: 0xf900, e: 0xfaff, c: 'Lo' },
  { s: 0xfb00, e: 0xfb06, c: 'Ll' },
  { s: 0xfe00, e: 0xfe0f, c: 'Mn' }, { s: 0xfe20, e: 0xfe2f, c: 'Mn' },
  { s: 0xfe30, e: 0xfe48, c: 'So' }, { s: 0xfe50, e: 0xfe52, c: 'Po' },
  { s: 0xfe54, e: 0xfe66, c: 'Po' },
  { s: 0xfeff, e: 0xfeff, c: 'Cf' },
  { s: 0xff01, e: 0xff03, c: 'Po' }, { s: 0xff04, e: 0xff04, c: 'Sc' },
  { s: 0xff05, e: 0xff06, c: 'Po' }, { s: 0xff07, e: 0xff07, c: 'Po' },
  { s: 0xff08, e: 0xff08, c: 'Ps' }, { s: 0xff09, e: 0xff09, c: 'Pe' },
  { s: 0xff0a, e: 0xff0a, c: 'Po' }, { s: 0xff0b, e: 0xff0b, c: 'Sm' },
  { s: 0xff0c, e: 0xff0c, c: 'Po' }, { s: 0xff0d, e: 0xff0d, c: 'Pd' },
  { s: 0xff0e, e: 0xff0f, c: 'Po' }, { s: 0xff10, e: 0xff19, c: 'Nd' },
  { s: 0xff1a, e: 0xff1b, c: 'Po' }, { s: 0xff1c, e: 0xff1e, c: 'Sm' },
  { s: 0xff1f, e: 0xff20, c: 'Po' }, { s: 0xff21, e: 0xff3a, c: 'Lu' },
  { s: 0xff3b, e: 0xff3b, c: 'Ps' }, { s: 0xff3d, e: 0xff3d, c: 'Pe' },
  { s: 0xff3f, e: 0xff3f, c: 'Pc' }, { s: 0xff41, e: 0xff5a, c: 'Ll' },
  { s: 0xff5b, e: 0xff5b, c: 'Ps' }, { s: 0xff5d, e: 0xff5d, c: 'Pe' },
  { s: 0xff5e, e: 0xff5e, c: 'Sm' }, { s: 0xff61, e: 0xff61, c: 'Po' },
  { s: 0xffe0, e: 0xffe6, c: 'Sc' }, { s: 0xfffd, e: 0xfffd, c: 'So' },
];

export function getCategoryCode(cp: number): CategoryCode {
  if (cp >= 0xd800 && cp <= 0xdfff) return 'Cs';
  if (cp >= 0xe000 && cp <= 0xf8ff) return 'Co';
  if (cp >= 0xf0000 && cp <= 0xffffd) return 'Co';
  if (cp >= 0x100000 && cp <= 0x10fffd) return 'Co';
  let lo = 0;
  let hi = CAT_RANGES.length - 1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const r = CAT_RANGES[mid];
    if (cp < r.s) hi = mid - 1;
    else if (cp > r.e) lo = mid + 1;
    else return r.c;
  }
  const block = blockName(cp);
  if (!block) return 'Cn';
  if (block.includes('IDEOGRAPH') || block.includes('HIRAGANA') || block.includes('KATAKANA') ||
      block.includes('HANGUL') || block.includes('SYLLABAR') || block.includes('ARMENIAN') ||
      block.includes('HEBREW') || block.includes('ARABIC') || block.includes('ETHIOPIC') ||
      block.includes('THAI') || block.includes('LAO') || block.includes('DEVANAGARI') ||
      block.includes('BENGALI') || block.includes('GEORGIAN') || block.includes('TAMIL')) return 'Lo';
  if (block.includes('SUPPLEMENT')) return 'Cn';
  if (block.startsWith('CJK SYMBOLS')) return 'Po';
  return 'So';
}

export function getCategoryLabel(cp: number): string {
  const code = getCategoryCode(cp);
  return `${code} ${CATEGORY_LABELS[code]}`;
}

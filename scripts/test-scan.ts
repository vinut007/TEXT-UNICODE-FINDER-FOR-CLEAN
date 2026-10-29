import { scanUnit } from '../src/lib/engine/scan';
import { buildCharMap, renderSegments } from '../src/lib/engine/unit-index';
import { DEFAULT_SCAN_OPTIONS } from '../src/types/analysis';
import type { CharFinding } from '../src/types/analysis';

let pass = 0;
let fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra ?? ''); }
}

// ---- 1. scanUnit finds each sample character ----
const samples: { label: string; text: string; expectCats: string[] }[] = [
  { label: 'Café (é non-ascii)', text: 'Café', expectCats: ['non-ascii'] },
  { label: 'NBSP', text: 'a\u00A0b', expectCats: ['whitespace'] },
  { label: 'ZWSP', text: 'a\u200Bb', expectCats: ['invisible'] },
  { label: 'BEL control', text: 'a\u0007b', expectCats: ['control'] },
  { label: 'curly quotes', text: '\u201Cquote\u201D', expectCats: ['non-ascii', 'non-ascii'] },
  { label: 'ideographic space', text: '\u3000', expectCats: ['whitespace'] },
  { label: 'mojibake Ã©', text: 'caf\u00C3\u00A9', expectCats: ['mojibake'] },
  { label: 'mojibake â€™', text: 'x\u00E2\u20AC\u201C y', expectCats: ['mojibake'] },
  { label: 'soft hyphen', text: 'soft\u00ADhyphen', expectCats: ['invisible'] },
  { label: 'plain ASCII', text: 'hello world 123', expectCats: [] },
];

console.log('\n== scanUnit ==');
for (const s of samples) {
  const cats: string[] = [];
  scanUnit(s.text, { ...DEFAULT_SCAN_OPTIONS }, (hit) => cats.push(hit.category));
  check(s.label, JSON.stringify(cats) === JSON.stringify(s.expectCats), `got ${JSON.stringify(cats)} want ${JSON.stringify(s.expectCats)}`);
}

// ---- 2. char map + renderSegments highlight by comparison ----
console.log('\n== char map render ==');
// Build fake findings from a scan of "Café mojibake:Ã© nb\u00A0sp"
const allText = 'Café mojibake:Ã© nb\u00A0sp zw\u200Bsp';
const findings: CharFinding[] = [];
const seen = new Map<string, CharFinding>();
scanUnit(allText, { ...DEFAULT_SCAN_OPTIONS }, (hit) => {
  const cp = hit.text.codePointAt(0)!;
  const key = hit.isSequence ? `mojibake:${hit.text}` : `${hit.category}:${cp}`;
  let f = seen.get(key);
  if (!f) {
    f = {
      key, codePoint: cp, char: hit.text, name: key, category: hit.category,
      count: 0, severity: hit.severity, description: '', isSequence: hit.isSequence,
      locations: [], locationsTruncated: false,
    };
    seen.set(key, f);
    findings.push(f);
  }
  f.count++;
});

const charMap = buildCharMap(findings);
check('char map has é (U+00E9)', charMap.single.has(0xE9));
check('char map has NBSP (U+00A0)', charMap.single.has(0xA0));
check('char map has ZWSP (U+200B)', charMap.single.has(0x200B));
check('char map has mojibake sequence Ã©', charMap.sequences.some((s) => s.text === 'Ã©'));

const segs = renderSegments(allText, charMap);
const hitSegs = segs.filter((s) => s.hit);
check('render produces hit segments', hitSegs.length >= 4, hitSegs.map((s) => s.text));
check('é segment highlighted', hitSegs.some((s) => s.text === 'é'));
check('NBSP segment highlighted', hitSegs.some((s) => s.text === '\u00A0'));
check('ZWSP segment highlighted', hitSegs.some((s) => s.text === '\u200B'));
check('mojibake segment highlighted as one unit', hitSegs.some((s) => s.text === 'Ã©'));

// reconstruct text from segments — must equal input (no chars lost/duplicated)
const rebuilt = segs.map((s) => s.text).join('');
check('segments reconstruct original text exactly', rebuilt === allText, JSON.stringify(rebuilt));

// ---- 3. offsets inside segments are consistent ----
let expectedStart = 0;
let offsetsOk = true;
for (const s of segs) {
  if (s.start !== expectedStart) offsetsOk = false;
  expectedStart += s.text.length;
}
check('segment starts are contiguous', offsetsOk);

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

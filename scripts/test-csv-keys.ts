import { unitKeyFor, fieldKey, buildUnitIndex, buildCharMap, renderSegments } from '../src/lib/engine/unit-index';
import type { AnalysisResult, Location } from '../src/types/analysis';

let pass = 0, fail = 0;
function check(name: string, cond: boolean, extra?: unknown) {
  if (cond) { pass++; console.log('  PASS', name); }
  else { fail++; console.log('  FAIL', name, extra ?? ''); }
}

// CSV location: record is 1-based (header = record 1). Preview keys are 0-based.
const loc: Location = {
  id: 'c:0:2:3:x',
  cpOffset: 3,
  utf16Offset: 3,
  length: 1,
  cpLength: 1,
  record: 2,       // 1-based record 2 = 0-based index 1
  fieldIndex: 2,
};
const key = unitKeyFor('csv', loc);
check('csv unit key maps 1-based record to 0-based key', key === fieldKey(1, 2), key);

// Full index build: a finding in record 3 (1-based) → preview looks up recordIndex 2
const result: AnalysisResult = {
  fileName: 't.csv', fileSize: 10, fileType: 'csv', encoding: 'UTF-8',
  encodingConfidence: 'strict', hasBom: false, formatDetail: '',
  scannedAt: 0, durationMs: 1,
  stats: { totalCodePoints: 5, nonAsciiCount: 1, unicodeWhitespaceCount: 0, invisibleCount: 0, controlCount: 0, mojibakeCount: 0, uniqueSuspicious: 1, bomCount: 0 },
  findings: [{
    key: 'non-ascii:00E9', codePoint: 0xE9, char: 'é', name: 'LATIN SMALL LETTER E WITH ACUTE',
    category: 'non-ascii', count: 1, severity: 'none', description: '',
    locations: [{ id: 'c:2:0:0:é', cpOffset: 0, utf16Offset: 0, length: 1, cpLength: 1, record: 3, fieldIndex: 0 }],
    locationsTruncated: false,
  }],
  byteLength: 10, warnings: [],
};
const index = buildUnitIndex(result);
check('index key for record 3 (1-based) is R2:C0', index.has(fieldKey(2, 0)), [...index.keys()]);

// renderSegments on a CSV cell value with é — highlight by map comparison
const charMap = buildCharMap(result.findings);
const segs = renderSegments('Café', charMap);
check('Café cell: é highlighted', segs.some((s) => s.hit && s.text === 'é'), segs.map((s) => [s.text, !!s.hit]));
check('Café cell: reconstruct', segs.map((s) => s.text).join('') === 'Café');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail > 0) process.exit(1);

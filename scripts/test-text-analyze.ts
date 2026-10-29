import '@/lib/buffer-polyfill';
import { analyzeFile } from '@/lib/engine/analyze';

const text = 'Hello world\nline with café and emoji 🎉\ntabs\there\nend';
const file = new File([text], 'pasted-text.txt', { type: 'text/plain' });

const options = {
  nonAscii: true,
  unicodeWhitespace: true,
  asciiWhitespace: false,
  invisible: true,
  control: true,
  mojibake: true,
  bom: true,
};

try {
  const buffer = await file.arrayBuffer();
  const result = await analyzeFile(buffer, file.name, file.size, 'text', options, {
    onStage: (i, p) => {
      if (p === 0 || p === 1) console.log(`stage ${i} progress ${p}`);
    },
    shouldCancel: () => false,
  });
  console.log('OK:', result.stats);
  console.log('findings:', result.findings.length);
} catch (err) {
  console.error('FAILED:', err);
  if (err.stack) console.error(err.stack);
}

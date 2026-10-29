// Polyfill the Node Buffer global required by mdb-reader's browser build.
// Must be imported before mdb-reader (ESM evaluates imports in order).
import { Buffer } from 'buffer';

const g = globalThis as typeof globalThis & { Buffer?: typeof Buffer };
if (typeof g.Buffer === 'undefined') {
  g.Buffer = Buffer;
}

export { Buffer };

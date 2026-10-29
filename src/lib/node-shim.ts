// Minimal Node globals needed by mdb-reader's dependency chain
// (readable-stream / stream-browserify / util reference `process`).
// Must be imported before those modules; ESM evaluates imports in order.
const g = globalThis as unknown as { process?: unknown };

if (typeof g.process === 'undefined') {
  g.process = {
    env: { NODE_ENV: import.meta.env?.MODE ?? 'production' },
    nextTick: (fn: (...args: unknown[]) => void, ...args: unknown[]) => {
      queueMicrotask(() => fn(...args));
    },
    browser: true,
    platform: 'browser',
    version: '',
    title: 'browser',
    argv: [],
    cwd: () => '/',
    pid: 0,
    features: {},
  };
}

export {};

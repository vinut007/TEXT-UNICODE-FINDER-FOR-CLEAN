import path from 'path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// mdb-reader's browser build (via create-hash → cipher-base → readable-stream)
// needs a few Node builtins. Alias them to browser implementations.
const nodePolyfills: Record<string, string> = {
  stream: 'stream-browserify',
  events: 'events',
  string_decoder: 'string_decoder',
  util: 'util',
};

export default defineConfig({
  plugins: [react()],
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'production'),
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      ...nodePolyfills,
    },
  },
  worker: {
    format: 'es',
  },
  build: {
    target: 'es2020',
    chunkSizeWarningLimit: 2000,
  },
  server: {
    port: 5173,
  },
});

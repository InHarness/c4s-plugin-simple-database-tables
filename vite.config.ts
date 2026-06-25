import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

/**
 * Vite library mode (brief section 7).
 *
 * Two entries: `src/index.ts` (backend, consumed by the host loader) and
 * `src/frontend.tsx` (frontend, loaded as native ESM via the host's import-map
 * shim). All runtime peers are EXTERNAL — the plugin does NOT bundle its own copy
 * of React/Tiptap/TanStack/etc. (two copies break hooks and shared state; the
 * frontend receives them from `window.__c4s_shared` through the host import map).
 */

// Peers provided by the host — must stay `external` (kept out of dist).
const EXTERNAL = [
  '@c4s/plugin-runtime',
  // Host UI Kit subpath — a distinct module id to Rollup, so it must be listed
  // separately from '@c4s/plugin-runtime' to keep the host UI out of dist.
  '@c4s/plugin-runtime/ui',
  '@inharness-ai/agent-adapters',
  'react',
  'react-dom',
  'react-dom/client',
  'react/jsx-runtime',
  '@tiptap/core',
  '@tanstack/react-query',
  // M33 phase 3: shared library peer (one instance via the host import map) — the
  // plugin's routes and the host's router must share the same route-tree machinery.
  '@tanstack/react-router',
  'express',
  'better-sqlite3',
  'zod',
];

export default defineConfig({
  build: {
    lib: {
      entry: {
        index: 'src/index.ts',
        frontend: 'src/frontend.tsx',
      },
      formats: ['es'],
      fileName: (_format, entryName) => `${entryName}.js`,
    },
    rollupOptions: {
      // Externalize peers + all @tiptap/* subpaths and node builtins.
      external: (id) =>
        EXTERNAL.includes(id) ||
        id.startsWith('@tiptap/') ||
        id.startsWith('node:'),
    },
    // Do not minify — the manifest must keep its default + named `manifest` export.
    minify: false,
    sourcemap: true,
    target: 'es2022',
  },
  plugins: [
    dts({
      include: ['src'],
      // Emit dist/index.d.ts and dist/frontend.d.ts for both entries.
      insertTypesEntry: true,
    }),
  ],
});

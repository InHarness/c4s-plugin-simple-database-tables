#!/usr/bin/env node
/**
 * dev:link — make the built plugin available to a local claude4spec host.
 *
 * Copies or symlinks `dist/` + `package.json` into a directory the host scans. The
 * target is PARAMETERIZED (no hardcoded user paths).
 *
 * Usage:
 *   node scripts/link-into-host.mjs --target <path> [--mode symlink|copy]
 *   C4S_PLUGIN_TARGET=<path> node scripts/link-into-host.mjs
 *
 * The target is one of the two ways to expose the plugin to the host:
 *   - project-local overlay (recommended in dev):
 *       <test-project>/.claude4spec/plugins/<plugin-name>/
 *     then in the host trust the project's plugins (trustProjectPlugins) and rebuild
 *     the ProjectContext;
 *   - workspace base: the loader's base scan location (see README).
 */

import { existsSync, mkdirSync, rmSync, cpSync, symlinkSync, lstatSync, readFileSync } from 'node:fs';
import { dirname, join, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const pkgRoot = resolve(__dirname, '..');

function parseArgs(argv) {
  const out = { mode: 'symlink', target: process.env.C4S_PLUGIN_TARGET ?? null };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--target') out.target = argv[++i];
    else if (a === '--mode') out.mode = argv[++i];
    else if (a.startsWith('--target=')) out.target = a.slice('--target='.length);
    else if (a.startsWith('--mode=')) out.mode = a.slice('--mode='.length);
  }
  return out;
}

function fail(msg) {
  console.error(`✗ ${msg}`);
  process.exit(1);
}

const { mode, target } = parseArgs(process.argv.slice(2));

if (!target) {
  fail(
    'No target. Pass --target <path> or set C4S_PLUGIN_TARGET.\n' +
      '  recommended (project-local overlay): <project>/.claude4spec/plugins/<plugin-name>',
  );
}
if (mode !== 'symlink' && mode !== 'copy') {
  fail(`Unknown --mode "${mode}" (allowed: symlink | copy).`);
}

const distDir = join(pkgRoot, 'dist');
const pkgJsonPath = join(pkgRoot, 'package.json');
if (!existsSync(distDir)) fail('No dist/. Run `npm run build` (or `npm run dev`) first.');
if (!existsSync(pkgJsonPath)) fail('No package.json in the package root.');

const targetDir = resolve(target);
mkdirSync(targetDir, { recursive: true });

/** Idempotently remove an existing entry (file/symlink/directory). */
function clean(p) {
  if (existsSync(p) || isSymlink(p)) rmSync(p, { recursive: true, force: true });
}
function isSymlink(p) {
  try {
    return lstatSync(p).isSymbolicLink();
  } catch {
    return false;
  }
}

const distTarget = join(targetDir, 'dist');
const pkgTarget = join(targetDir, 'package.json');

clean(distTarget);
clean(pkgTarget);

if (mode === 'symlink') {
  symlinkSync(distDir, distTarget, 'dir');
  symlinkSync(pkgJsonPath, pkgTarget, 'file');
} else {
  cpSync(distDir, distTarget, { recursive: true });
  cpSync(pkgJsonPath, pkgTarget);
}

const name = (() => {
  try {
    return JSON.parse(readFileSync(pkgJsonPath, 'utf8')).name ?? basename(pkgRoot);
  } catch {
    return basename(pkgRoot);
  }
})();

console.log(`✓ ${mode === 'symlink' ? 'Symlinked' : 'Copied'} plugin "${name}" → ${targetDir}`);
console.log('  Next, in the host:');
console.log('   1) trust the project plugins (trustProjectPlugins) and rebuild the ProjectContext,');
console.log('   2) add the entity type to config.entities,');
console.log('   3) verify: GET /api/_meta/plugins (loaded) + GET /api/_meta/entities (active).');
console.log(
  '  Changing plugin CODE = rebuild (`npm run dev`); the oś-B watcher picks up the new\n' +
    '  dist/ and hot-reloads (cache-bust import → onUnregister → re-register → rebuild\n' +
    '  ProjectContext → WS plugin:reloaded) — no process restart.',
);

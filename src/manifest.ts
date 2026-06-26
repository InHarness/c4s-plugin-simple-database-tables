/**
 * `PluginManifest` — the plugin envelope (host 1.0.0 contract).
 *
 * The host loader does `await import(pkg)`, extracts the manifest (`export manifest`
 * or `default`), gates `hostApiVersion` / `engines`, then fans out per capability
 * kind. The package ONLY exports the manifest — the host calls `registerPlugin`.
 *
 * This plugin contributes EXACTLY ONE entity type (`database-table`) and NOTHING
 * else — there is no `capabilities` (no settings / commands / writingStyles). The
 * mandatory M05 system-prompt fragment ships on the entity itself.
 */

import type { PluginManifest } from './host';
import { DatabaseTableEntity } from './plugin';

export const manifest: PluginManifest = {
  // KEEP in sync with package.json "name".
  name: '@inharness-ai/c4s-plugin-simple-database-tables',
  version: '0.1.0',
  // Major-only compatibility gate against host 1.0.0 — `^1.0.0` satisfies 1.0.0.
  hostApiVersion: '^1.0.0',
  engines: { node: '>=20' },

  /**
   * REQUIRED teardown. Called on the OLD version before re-register during
   * hot-reload, which tears the module down and re-registers it repeatedly.
   * Must be IDEMPOTENT and must NEVER THROW — the host drops entities/MCP/routes
   * itself; we only release what we register ourselves (none today), wrapped so a
   * throw can never break the reload.
   */
  onUnregister(): void {
    try {
      // Releases the MCP server, unmounts the router and detaches frontend
      // renderers — all owned by the host registry, nothing extra to detach here.
    } catch {
      // Swallow — teardown must never throw.
    }
  },

  // Only the entity contribution — no `capabilities`.
  contributes: {
    entities: [DatabaseTableEntity],
  },
};

export default manifest;

# c4s-plugin-scaffold

An empty, ready-to-start **[claude4spec](https://www.npmjs.com/package/@inharness-ai/claude4spec) plugin scaffold** — an npm package that contributes a new **entity type** along with its full vertical slice (L1–L9 + M05) and a complete `PluginManifest` envelope (entities + writing styles + settings + commands).

"Empty" = the complete **structure** of every contract slot, with **stubs over one placeholder entity**. After `clone` you replace the placeholders (`__*__`) and add logic — you don't delete the examples.

> ⚠️ **This scaffold targets the real host contract `HOST_API_VERSION = 1.0.0`** — read from the source of the installed `@inharness-ai/claude4spec`. It differs from the 0.0.2 brief in a few places (see [Drift](#drift--brief-vs-the-real-host-code)).

---

## Quick start

```bash
npm install
npm run build       # → dist/index.js (backend) + dist/frontend.js (frontend), ESM
npm run typecheck   # tsc --noEmit
```

Then replace the placeholders (see [Rename map](#rename-map)) and link into a host (see [Dev loop](#dev-loop)).

---

## Rename map

Replace these tokens in `src/` (plus `name` in `package.json` + `manifest.ts`):

| Token | Meaning | Example | Format |
| --- | --- | --- | --- |
| `c4s-plugin-scaffold` | npm package name = `PluginManifest.name` | `@acme/c4s-plugin-glossary` | npm (scoped, kebab) |
| `__plugin_name__` | same as above (in comments) | `@acme/c4s-plugin-glossary` | npm |
| `__entity_type__` | entity `type`; base of the MCP name (`__entity_type__-tools`), XML references, the `config.entities` entry | `glossary` | kebab-case |
| `__entity_table__` | `table` — the SQLite table name | `glossary` | snake_case |
| `__EntityName__` | React component / class / export names | `Glossary` | PascalCase |
| `__ENTITY_TITLE__` | UI labels (`label`, role noun) | `Glossary` | human |

Example find-replace (BSD/macOS `sed`; careful — do it on a fresh clone):

```bash
# 1) tokens in source files
grep -rl '__entity_type__\|__entity_table__\|__EntityName__\|__ENTITY_TITLE__\|__plugin_name__' src \
  | xargs sed -i '' \
    -e 's/__EntityName__/Glossary/g' \
    -e 's/__ENTITY_TITLE__/Glossary/g' \
    -e 's/__entity_table__/glossary/g' \
    -e 's/__entity_type__/glossary/g' \
    -e 's/__plugin_name__/@acme\/c4s-plugin-glossary/g'

# 2) package name (package.json) and manifest.name — replace "c4s-plugin-scaffold" by hand
```

> Note: an npm package name cannot start with `_`, so the scaffold uses the real name `c4s-plugin-scaffold` instead of the `__plugin_name__` token for `package.json#name` and `manifest.name`. The `__plugin_name__` token appears only in comments/identifiers.

The entity has **one** placeholder data field besides `slug` (`title`) — marked with `// TODO: replace with your entity's fields`.

---

## Slot map

Backend (`src/index.ts` → manifest; the host loader does `import` and `registerPlugin`):

| Slot | File | What |
| --- | --- | --- |
| Envelope | `src/manifest.ts` | `PluginManifest` — **`onUnregister` (REQUIRED, on the manifest)** + `contributes.{entities,writingStyles,settings,commands}` |
| Entity | `src/plugin.ts` | `EntityContribution` — identity (`type/table/label/labelPlural/displayOrder/pathPrefix/slugFrom`) + slots |
| Identity | `src/identity.ts` | shared constants + `slugFrom` (no back/front imports) |
| L1 | `src/entity/backend/migrations.ts` | `SqlMigration[]` — placeholder table |
| L2 | `src/entity/backend/services.ts` | domain service (CRUD) — built in `mount` |
| L3 | `src/entity/backend/mcp-server.ts` | `${type}-tools` — 5 CRUD tools (agent-adapters + zod) |
| L4 | `src/entity/backend/routes.ts` | Express router (CRUD + `POST /:slug/restore`) |
| mount | `src/plugin.ts` → `backend.mount(ctx)` | registers router/MCP/service imperatively |
| L9 | `src/entity/serializer.ts` | `EntitySerializer` (deterministic snapshot/restore/diff + views) |
| M05 | `src/entity/system-prompt.ts` | `SystemPromptContribution` (role noun, count stat, mcp tools line) |

Frontend (`src/frontend.tsx`; loaded via the host's import-map shim, registered as a side effect):

| Slot | File | What |
| --- | --- | --- |
| L8 chip/card/row | `src/entity/frontend/render-{chip,card,row}.tsx` | pure-React; **entity injected by the host** in props |
| L8 detail | `src/entity/frontend/detail-panel.tsx` | `{ slug, onDeleted, onRenamed, onBack }` |
| data | `src/entity/frontend/hooks.ts` | `useGetBySlug` + `listByTags` |
| L8 slash | `src/entity/frontend/slash-command.ts` | `EditorExtensionRegistration` (`/__entity_type__`) |

Full envelope (`src/capabilities/*`): `writing-styles.ts`, `settings.ts`, `commands.ts` — stubs.

### Render component rules (pure-React)
Chip/card/row render in **two pipelines** (the editor's Tiptap **and** chat's react-markdown). Therefore:
- **No** `useEditor()` / `useCurrentEditor()`, **no** `editor.commands.*` / `editor.chain()`, **no** dependency on ProseMirror state.
- Click calls only `editorBridge.openEntity(type, slug)`.
- **The host provides the entity** (`{ slug, entity, onOpen }`); `entity === null` ⇒ broken chip. (This is a difference vs the older docs, which described self-fetch.)

---

## Toolchain

- **Vite library mode** (`vite.config.ts`): two entries (`src/index.ts`, `src/frontend.tsx`), **ESM** output, all runtime peers as `external` (React/Tiptap/TanStack/Express/SQLite/zod/agent-adapters/`@c4s/plugin-runtime`) — the plugin does **not** bundle heavy deps (two copies of React/Tiptap break hooks). `vite-plugin-dts` emits `.d.ts` for both entries.
- **`type: "module"`** (native ESM — the loader does `await import(...)`).
- **`src/host.ts`** — the single import surface for `@c4s/plugin-runtime`.
- **`src/c4s-runtime.d.ts`** — an **ambient type fallback** for the host (`@c4s/plugin-runtime`, `@inharness-ai/agent-adapters`, `express`, `zod`, `@tanstack/react-query`). The host does not publish types for plugin authors today; this file lets `npm run typecheck` pass offline. (The name intentionally ≠ `host.ts`, so TS does not treat it as the declaration file for `host.ts`.) **TODO: delete it once the host ships official types.**

---

## Dev loop

The plugin's `hostApiVersion` must satisfy `semver.satisfies('1.0.0', range)` ⇒ use **`^1.0.0`**. Any non-1 major (e.g. `^2.0.0`) → status `incompatible` (`PLUGIN_HOST_API_MISMATCH`), the plugin is skipped (it does not crash the host).

All five runtime mechanisms are part of the current contract — there are no "phases":

| Mechanism | Available |
| --- | --- |
| Process-global base (workspace/npm — the loader scans `~/.claude4spec/workspaces.json → workspace.plugins[]`) | Yes |
| `hostApiVersion` / `engines` gate | Yes |
| Per-project activation without restart (axis A) | Yes |
| Project-local overlay `<cwd>/.claude4spec/plugins/<name>/` + the `trustProjectPlugins` gate | Yes |
| Hot-reload of the pool composition (axis B) | Yes |

**Step 1 — build (watch):** `npm run dev` — Vite watch builds `dist/` (ESM, peers external).

**Step 2 — expose to the host (two paths):**
- **Overlay (recommended in dev)** — drop `dist/` + `package.json` into `<project>/.claude4spec/plugins/<plugin-name>/` and accept `trustProjectPlugins`. `npm run dev:link -- --target <project>/.claude4spec/plugins/<plugin-name>` automates it (symlink default, `--mode copy` fallback). The loader resolves the entry via `package.json` (`exports`/`module`/`main`/`index.*`) and extracts the manifest from `export manifest` **or** `default`. `trustProjectPlugins` is machine-local (`~/.claude4spec/workspaces.json`), never in the repo.
- **Base** — make the package visible as a workspace plugin in `workspace.plugins[]` (`npm link`, a `file:` dependency, or a symlink) and point `--target` at the loader's base scan location.

Then add the type to `config.entities`: `{ "$schemaVersion": 3, "entities": [ …, "__entity_type__" ] }`.

**Step 3 — hot-reload (axis B), no restart:** the watcher picks up the `dist/` change and runs the pipeline

```
cache-bust import → onUnregister → re-registerPlugin → rebuild ProjectContext → WS plugin:reloaded
```

with **no process restart**. The precondition is a working `onUnregister` — which the scaffold already ships.

**Steps 4–5 — verify:**
- `GET /api/_meta/plugins` — the package is `loaded` (if `skipped`/`incompatible`, check `reason` / `PLUGIN_HOST_API_MISMATCH`),
- `GET /api/_meta/entities` — `__entity_type__` is in `active`,
- the sidebar shows the tab (if `sidebarTab` is defined),
- chat: the agent sees `__entity_type__-tools` in the system prompt.

---

## Drift — brief vs the real host code

The 0.0.2 brief was generated **before** the host commit `Host API baseline 1.0.0 + de-phase plugin system`, so it lags the actual contract in a few places. The binding source is the **host code** (`src/` in `@inharness-ai/claude4spec`, `HOST_API_VERSION = 1.0.0`). This scaffold targets the code. The brief and the host agree on the version (`^1.0.0`) and on de-phasing; they differ on:

| Topic | 0.0.2 brief | real host code (1.0.0) |
| --- | --- | --- |
| `onUnregister` | on the entity | **on `PluginManifest`** (required) — `shared/plugin-host/manifest.ts` |
| Backend | declarative `mcpServer`/`services(di,db)`/`routes{prefix,router}` | **a single imperative `backend.mount(ctx)`** (`ctx.registerMcpServer`/`registerEntityService`/`app.use`) |
| Entity fields | not emphasized | `label`/`labelPlural`/`displayOrder`/`pathPrefix` **required** in `EntityModuleManifest` |
| `MountContext` | `{app, mcpHost, db, cwd}` | `{app, db, host, cwd, ws, tagsService, versionService, referencesService, entityStore, registerMcpServer(), registerEntityService()}` |
| Chip/card/row | self-fetch | host injects `entity`: `{slug, entity, onOpen}` + `useGetBySlug`/`listByTags` slots |
| `@c4s/plugin-runtime` types | come from the specifier (drop the fallback) | not published → ambient `c4s-runtime.d.ts` fallback is **required** for offline typecheck |

Full drift writeup (feedback for the spec author): see the patch in `.claude4spec/patches/`.

---

## Acceptance criteria

- [x] `npm install && npm run build` → `dist/index.js` + `dist/frontend.js` (ESM).
- [x] `npm run typecheck` is green (thanks to `c4s-runtime.d.ts`).
- [x] `dist/index.js` exports `PluginManifest` as default **and** named (`manifest`).
- [x] The manifest fills all four `contributes.*`.
- [x] The entity is wired: L1, L2, L3 (`__entity_type__-tools`, 5 tools), L4 (CRUD+restore), `backend.mount`, L9, M05, `onUnregister` (on the manifest).
- [x] Chips are pure-React (no `useEditor`/`editor.commands`/PM state).
- [x] Vite `external` covers all peers (no bundled React/Tiptap).
- [x] `scripts/link-into-host.mjs` parameterizes the target (symlink + copy).
- [x] Zero domain — only the placeholder entity.

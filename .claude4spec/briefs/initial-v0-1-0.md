---
type: brief
source: release-diff
from_release: null
to_release: v0.1.0
generated_at: '2026-06-24T19:56:24.092Z'
generator_version: brief-author@0.1
implemented: true
---
# Initial brief: v0.1.0

This is the first release of the **Simple Database Tables** claude4spec (C4S) plugin. There is no predecessor, so everything below is new. The plugin contributes exactly **one entity type — `database-table`** — backed by a SQLite table named `database_table`, and ships nothing else: no `capabilities`, only `contributes.entities` plus an M05 system-prompt fragment.

## What the system is

A host-mounted plugin that lets a project define database-table specs (columns, indexes, soft foreign keys) and exposes them over an MCP server, an HTTP API, and React renderers. Each table is identified by a kebab-case `slug = slugify(name)` which is its primary key. Tables are serialized to disk as the source of truth.

### Manifest & lifecycle

```jsonc
{
  "name": "c4s-plugin-simple-database-tables",
  "version": "0.1.0",
  "hostApiVersion": "^1.0.0",          // major-only compat gate against host 1.0.0
  "contributes": { "entities": ["database-table"] }
  // NO "capabilities" key at all
}
```

- The `EntityModule` declares `pathPrefix: "/database-tables"` (no `/api`). The host mounts the plugin's `ctx.app` under `/api/projects/:id`, so effective paths are `/api/projects/:id/database-tables/...`.
- `onUnregister()` must be **idempotent and must never throw** — hot-reload tears down and re-registers repeatedly. It releases the MCP server, unmounts the router, and detaches frontend renderers.
- The MCP server is registered as a **factory** (`() => createServer`), not a shared instance, so each registration gets a fresh server (safe under hot-reload).
- Bootstrapped from the scaffold: `npx degit InHarness/c4s-plugin-scaffold c4s-plugin-simple-database-tables`. Slots L1–L9 + M05 map 1:1 onto scaffold files.

## Data model

### SQLite table `database_table`

(Deliberately not `table`, which is a reserved SQL keyword.)

| column | SQL type | notes |
|---|---|---|
| `slug` | TEXT NOT NULL | PK, UNIQUE, kebab-case, = `slugify(name)` |
| `name` | TEXT NOT NULL | human display name (e.g. `order_items`) |
| `description` | TEXT NULL | |
| `columns` | JSON NOT NULL DEFAULT `[]` | serialized `ColumnSpec[]` |
| `indexes` | JSON NOT NULL DEFAULT `[]` | serialized `IndexSpec[]` |
| `created_at` | TEXT NOT NULL | ISO timestamp, set at insert |
| `updated_at` | TEXT NOT NULL | ISO timestamp, bumped on every UPDATE/restore |

Index: `idx_database_table_name` on `(name)`, non-unique. **No enforced FKs between rows — soft-FK only.**

### DTOs

**`ColumnSpec`** (one entry of `columns[]`):
- `name: string` (required, snake_case), `type: string` (required; dialect-agnostic: text/integer/json/boolean/timestamp/…)
- `nullable?: boolean` (default false), `unique?: boolean`, `pk?: boolean`
- `fk?: { table: string, column: string }` — soft FK; dangling target produces a warning only
- `default?: string`, `enumValues?: string[]`, `description?: string`

**`IndexSpec`** (one entry of `indexes[]`):
- `columns: string[]` (required, ordered), `unique?: boolean`, `name?: string` (derived if omitted)

**`DatabaseTableSnapshot`** — full entity shape, also the on-disk file format:
- `slug: string` (PK/identity), `name: string`, `description?: string`
- `columns: ColumnSpec[]`, `indexes: IndexSpec[]`
- `tags?: string[]` (synced on restore), `created_at?: string`, `updated_at?: string`

**`DatabaseTableListItem`** — trimmed list shape:
- `slug: string`, `name: string`, `description?: string`
- `columnCount: integer` (= `columns.length`), `hasPrimaryKey: boolean` (any column with `pk=true`), `tags?: string[]`

## Backend behavior (L1–L4)

Domain service (L2) rules:
- **create**: sets `slug = slugify(name)`; soft-FK targets that don't yet exist go into a `warnings[]` array, never an error — so tables can be created in any order.
- **update**: partial. Rename happens **only via an explicit `newSlug`** field; it propagates to every column where `fk.table === oldSlug` and to all M19 references.
- **delete**: CASCADEs the table's `entity_tag` rows, but does **not** cascade soft-FKs; references pointing at the deleted slug are returned in `danglingFks[]`.
- **restore**: UPSERT by slug — replaces `columns[]` and `indexes[]` wholesale and syncs the tag set.

L3 MCP server: five CRUD tools (`create` / `get` / `list` / `update` / `delete`).

### HTTP API (L4 Express router, relative to `pathPrefix`)

| Method & path | Request | Response | Notes |
|---|---|---|---|
| `GET /database-tables` | — | `DatabaseTableListItem[]` | derived `columnCount` / `hasPrimaryKey`, not full `columns[]` |
| `GET /database-tables/:slug` | — | `DatabaseTableSnapshot` | 404 if slug not found |
| `POST /database-tables` | name + table def (slug auto-derived) | `DatabaseTableSnapshot` (201) | unresolved soft-FKs → `warnings[]` |
| `PATCH /database-tables/:slug` | partial fields; `newSlug` to rename | `DatabaseTableSnapshot` | rename propagates to `fk.table` refs + M19 |
| `DELETE /database-tables/:slug` | — | includes `danglingFks[]` | CASCADEs `entity_tag`; soft-FKs not cascaded |
| `POST /database-tables/:slug/restore` | full `DatabaseTableSnapshot` | `DatabaseTableSnapshot` | UPSERT by slug; used by L9 boot/file-watch + release restore |

## Frontend (L5 / L8)

- All renderers are **pure-presentational** React: props-in, no `useEditor()`, no `useQuery()`, no fetch in the component. Data resolution is host-injected via the `useGetBySlug` hook (`use__EntityName__BySlug`).
- `renderChip`, `renderCard`, `renderRow` stay pure-presentational. **Database Table List** uses `renderRow` (renders a single row: name, column-count badge, description); the list header `EntityListHeader` is host territory. Insertion via the slug-aligned slash command **`/database-table`** (not `/dbtable`).
- **Database Table Detail Panel** uses the Host UI Kit (L12/M34) from `@c4s/plugin-runtime/ui` (re-exported through `src/host.ts`): `DetailPanelShell` (frame + breadcrumb, no `title` prop — header derives from last breadcrumb segment), `FieldGrid`, `FieldRow` (value passed as `children`, not a `value` prop). Panel self-fetches via the plugin's own `useGetBySlug` (not the M20 embed hook `useEntity`).
- Build: `@c4s/plugin-runtime/ui` must be in `rollupOptions.external` (Vite) — not bundled by the plugin. Design tokens bridged as `--c-*` CSS custom properties. No new `peerDependencies` (subpath ships with the already-declared `@c4s/plugin-runtime` peer).

## Serialization (L9)

The on-disk file is the source of truth (M29), not the SQLite row. Each entity serializes to `.claude4spec/entities/database-table/<slug>.json`, content = a `DatabaseTableSnapshot`.
- `snapshot()` reads the SQLite row + tag set → full `DatabaseTableSnapshot` with `tags[]` appended.
- `restore()` UPSERTs by slug, replaces `columns[]`/`indexes[]` wholesale, syncs tags; triggered on boot/file-watch (file→DB) and on named-release restore.
- `diff()` compares two snapshots, reporting added/removed/changed columns, indexes, and tags; used by release diffing and the file-watch reconciler.

## Acceptance criteria (10)

1. A new table's slug equals `slugify(name)`, and the SQLite table is named `database_table` (not reserved `table`).
2. A non-existent `fk.table` on a column produces a `warnings[]` entry, not an error, so tables can be created in any order.
3. A rename happens only via an explicit `newSlug` and propagates to every `fk.table === oldSlug` and all M19 references.
4. The list view's `renderRow` is pure-presentational, resolves data only through host-injected `useGetBySlug`, and never calls `useEditor()`.
5. Deleting a table CASCADEs its `entity_tag` rows but not soft-FKs; dangling references are returned in `danglingFks[]`.
6. `onUnregister()` is idempotent and never throws, so hot-reload cannot break on teardown.
7. `restore()` UPSERTs by slug, replaces `columns[]` and `indexes[]`, and syncs the tag set from the snapshot.
8. The detail panel renders via Host UI Kit (`DetailPanelShell` / `FieldGrid` / `FieldRow`) and fetches data with the plugin's own `useGetBySlug`; the `/ui` subpath is externalized in the Vite build.
9. The list endpoint returns `DatabaseTableListItem` rows with derived `columnCount` and `hasPrimaryKey` instead of full `columns[]`.
10. The plugin's MCP server is registered as a factory (`() => createServer`) rather than a shared instance.

`check_consistency` reports clean (0 errors / 0 warnings) at this release.

## For implementers

- **Migration / L1**: create SQLite table `database_table` with columns above; `columns`/`indexes` as JSON TEXT `DEFAULT '[]'`; add non-unique index `idx_database_table_name (name)`. Do not add real FK constraints.
- **Domain service / L2**: implement `create` (slugify + `warnings[]`), `update` (partial; rename only on `newSlug`, propagate to `fk.table===oldSlug` + M19), `delete` (CASCADE `entity_tag`, return `danglingFks[]`), `restore` (UPSERT by slug, replace `columns[]`/`indexes[]`, sync tags).
- **MCP server / L3**: export a factory `() => createServer` exposing tools `create`/`get`/`list`/`update`/`delete`.
- **Express router / L4**: mount under `pathPrefix "/database-tables"`; implement the 6 routes in the table above; list route returns `DatabaseTableListItem`, others exchange `DatabaseTableSnapshot`.
- **Frontend / L5–L8**: register `renderChip`/`renderCard`/`renderRow` (pure, use injected `useGetBySlug`); register `/database-table` slash command; build detail panel from `DetailPanelShell`/`FieldGrid`/`FieldRow` imported via `src/host.ts` from `@c4s/plugin-runtime/ui`; add that subpath to Vite `rollupOptions.external`.
- **Serialization / L9**: implement `snapshot()`, `restore()`, `diff()` against `.claude4spec/entities/database-table/<slug>.json` (= `DatabaseTableSnapshot`); wire restore to boot/file-watch and release restore.
- **Manifest / M05**: `hostApiVersion: "^1.0.0"`, `contributes.entities: ["database-table"]`, no `capabilities`; M05 system-prompt teaches slug rules, soft-FK semantics, and the `database_table` naming; ensure `onUnregister()` is idempotent and never throws.

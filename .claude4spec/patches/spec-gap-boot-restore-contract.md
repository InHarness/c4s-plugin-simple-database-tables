---
type: patch
brief: initial-v0-1-0.md
patch_kind: missing
created_at: 2026-06-24T00:00:00Z
created_by: claude-code
---

# Plan — spec the boot-restore executive contract (serializer.restore → host writer) + missing boot/file-watch AC

> Execution note: this is a PLAN. The edits below (page bodies + AC entities) must be
> applied from a C4S session opened in THIS project — AC creation needs this project's
> MCP server. Anchors are the indexer's; preserve them, append under them.

## The gap

The spec DECLARES the boot-restore behavior but never specifies the executive
contract — the layer where the live bug (`GET /database-tables` returns `[]`) sits.

- `pages/serialization.md` anchor `lqos2ehf` (`## restore()`): says only
  *"the runtime restores it into SQLite (file → DB)"* — no named method, no writer.
- `pages/serialization.md` anchor `jsxi8qwp` (`# Serialization (L9)`): *"The file on
  disk is the source of truth (M29)."*
- `pages/backend.md` anchor `nrqufia2` (`## L2 — Domain service`): lists
  `create / update / delete / restore`; `restore` described behaviorally
  (*"UPSERT by slug, replace columns[]/indexes[], sync tags"*) — no `upsert` method,
  no `actor`/`opts`.
- Host write boundary (`HostEntityWriter`, `upsertDatabaseTable`, `syncTags`):
  **total white spot** — 0 hits across `pages/`.
- Acceptance criteria: only `ac-restore-upserts-by-slug-replaces-colu` (requirement,
  active, tags `serialization`, verifies dto `database-table-snapshot` + endpoint
  `post-database-tables-slug-restore`). It covers the HTTP surface ONLY — **no AC
  covers the boot/file-watch trigger**, which is exactly why the bug shipped invisibly.

## The confirmed real contract (verified in host source, not yet in any spec)

From host `src/server/services/entity-writer.ts` + the still-present disabled builtin
`src/server/entities/database-table/serializer.ts`:

- `serializer.restore(snapshot, ctx)` delegates persistence to the host writer:
  `ctx.writer.upsertDatabaseTable(slug, { name, description, columns, indexes, slug }, ctx.actor)`
  then `ctx.writer.syncTags('database-table', slug, tags)`, returning
  `{ op, entity, warnings? }`. It does NOT touch raw SQL and does NOT call
  `ctx.writer.restore?/upsert?` (those methods do not exist — the current stub no-ops).
- `HostEntityWriter.upsertDatabaseTable` calls the L2 service
  `upsert(slug, input, actor, { capture: false, writeFile: false })` and expects
  `{ dbTable, op, warnings }`.
- Host limitation: boot-restore (`EntityIndexer.indexAll` over `DEP_ORDER`) only
  iterates the host's HARDCODED builtin types. `database-table` works only because it
  is still a hardcoded host type. A genuinely new plugin type would not be boot-restored
  until the host iterates `host.listEntities()` instead of `DEP_ORDER`.

## Edits to make (in a C4S session in this project)

### E1 — `pages/serialization.md`, under anchor `lqos2ehf` (`## restore()`)

Append a new subsection (new heading → indexer assigns its own anchor) titled e.g.
`### Executive contract (host writer)`, documenting:

- `restore(snapshot, ctx)` delegates to `ctx.writer.upsertDatabaseTable(slug, { name,
  description, columns, indexes, slug }, ctx.actor)` then
  `ctx.writer.syncTags('database-table', slug, tags)`; returns `{ op, entity, warnings? }`.
- The host writer calls the L2 `upsert(slug, input, actor, opts)` with
  `{ capture: false, writeFile: false }` on boot/file-watch (host orchestrates files
  during the index rebuild; no versioning capture). The HTTP `/:slug/restore` route
  calls the same `upsert`.
- Host limitation prose: boot-restore currently iterates only hardcoded builtin types
  (`DEP_ORDER`); a new plugin type needs the host to enumerate `host.listEntities()`.
  (Prose note, NOT an AC — there is no plugin-side entity to verify it against.)

### E2 — `pages/backend.md`, under anchor `nrqufia2` (`## L2 — Domain service`)

Add a bullet to the method list:

- **upsert** — UPSERT by slug. No row for slug → INSERT (slug used verbatim, NOT
  re-derived), compute soft-FK `warnings[]`, `op: 'created'`; else → UPDATE
  name/description/columns/indexes, `op: 'updated'`. Returns `{ dbTable, op, warnings }`.
  Honors `opts.writeFile === false` (skip file persist) and ignores `opts.capture`.
  `restore` (boot/file-watch + HTTP `/:slug/restore`) and the host writer's
  `upsertDatabaseTable` both delegate to it; `actor: 'user' | 'agent'`.

Optionally reword the existing `restore` bullet to: *"restore — delegates to upsert();
syncs tags via the host writer's syncTags (see serialization)."*

### E3 — Acceptance criteria (create via `create_ac`)

**AC-boot** (the missing trigger):
- statement: *"On boot and on snapshot file change (file-watch), the runtime restores
  the on-disk snapshot into SQLite by UPSERTing by slug, so a database_table row exists
  without any HTTP call."*
- kind: `requirement` · status: `active`
- verifies: dto `database-table-snapshot`
- tags: `serialization`

**AC-writer-contract** (the executive contract):
- statement: *"restore() persists via the host entity writer (upsertDatabaseTable +
  syncTags) and the L2 upsert(slug, input, actor, opts) method — never raw SQL — and on
  the boot/file-watch path runs with capture=false and writeFile=false."*
- kind: `requirement` · status: `active`
- verifies: dto `database-table-snapshot`, endpoint `post-database-tables-slug-restore`
- tags: `serialization`, `backend`

## Open decisions (recommended defaults baked in above)

1. **Name the L2 method `upsert`** (recommended — matches the code fix where `restore`
   delegates to `upsert`) vs keep describing `restore` only. Default: introduce `upsert`.
2. **Tag for the boot AC**: reuse existing `serialization` (recommended) vs new
   `host`/`boot` tag (none exists today). Default: reuse `serialization` (+ `backend`
   on the contract AC).
3. **verifies target for AC-boot**: dto `database-table-snapshot` only (recommended) vs
   also a concrete `database-table` entity. Default: dto only (boot path has no endpoint).

## Cross-reference

`patches/initial-v0-1-0-host-integration-points.md` currently records the writer API as
"assumed/guessed". Once the code fix lands, replace those guesses there with the now-known
real contract (`writer.upsertDatabaseTable` + `syncTags`; `service.upsert(slug, input,
actor, { capture, writeFile })`) and add the host boot-restore limitation. Keep that patch
note and this spec plan consistent.

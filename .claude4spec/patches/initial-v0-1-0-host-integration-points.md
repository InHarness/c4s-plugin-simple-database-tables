---
type: patch
brief: initial-v0-1-0.md
patch_kind: missing
created_at: 2026-06-24T00:00:00Z
created_by: claude-code
---

# Patch — undocumented host integration points (tags, references, file store, client prefix)

## What I found

Several behaviors the brief mandates depend on host-owned services whose **method
names/signatures are not specified** by the brief or the scaffold's ambient types
(`MountContext.tagsService / referencesService / entityStore` are typed `any`;
`RestoreContext.writer` likewise). I had to assume an API surface:

- **Tag sync / CASCADE `entity_tag` (AC5, AC7).** `delete` must CASCADE the table's
  `entity_tag` rows and `restore` must sync the tag set. I call `ctx.tagsService`
  defensively, trying `getEntityTags/setEntityTags/clearEntityTags` (with
  `getTags/syncTags/...` fallbacks), each capability-checked so a missing method is a
  no-op rather than a crash. The pure-SQL parts (slug, columns, indexes, danglingFks,
  warnings) are fully implemented and tested; the tag side effects need the real API.
- **M19 reference propagation on rename (AC3).** I call
  `ctx.referencesService.propagateSlugChange(type, oldSlug, newSlug)` (the name the
  scaffold's route comment suggests), guarded by a capability check. The in-row
  `fk.table === oldSlug` propagation IS implemented in SQL and tested.
- **Snapshot file persistence (M29).** `create/update/delete/restore` call
  `ctx.entityStore.write/remove(type, slug, snapshot)` defensively; the exact
  entityStore API is host-owned.
- **`RestoreContext.writer` API — NOW KNOWN (was a guess).** The original `restore()`
  guessed `writer.restore?.()` / `writer.upsert?.()`, which **do not exist**, so it
  silently no-op'd and on-disk snapshots were never persisted into SQLite on boot. The
  real contract (verified against host source) is:
  - `ctx.writer` is the host `HostEntityWriter`. Per-type method:
    `upsertDatabaseTable(slug, { name, description?, columns, indexes, slug }, actor)
    → { entity, op: 'created' | 'updated', warnings?: string[] }`.
  - `ctx.writer.syncTags(type, slug, tags: string[]): void` syncs the tag set. It
    first checks `host.entityExists(type, slug)`, so the row must be **upserted before**
    `syncTags` is called (the restore ordering guarantees this).
  - `upsertDatabaseTable` internally calls
    `requireService('database-table').upsert(slug, input, actor, { capture:false, writeFile:false })`
    and expects `{ dbTable, op, warnings }`. `requireService` resolves through the same
    `registerEntityService` map this plugin writes to, so it returns **our** service —
    we therefore had to add a `upsert(slug, input, actor, opts)` method (the service had
    only `create/update/restore`). `MutateOpts = { capture?, writeFile? }`; the index
    rebuild passes `writeFile:false` (host persists files once at the end) and
    `capture:false` (no `entity_version` capture on reindex).
  - `warnings` is `string[]` on the writer/restore path — our HTTP/MCP `create/update`
    return richer `FkWarning[]` objects, so `upsert` maps `FkWarning.message` to strings.
  - **Host boot-restore limitation.** `EntityIndexer.indexAll()` only iterates the host's
    **hardcoded `DEP_ORDER`** (and the hardcoded `DELETE FROM database_table` reindex
    reset + `HostEntityWriter.upsertDatabaseTable`). `database-table` happens to be in
    that list (the builtin is disabled in `registerAll.ts` but its host wiring remains),
    so this plugin gets boot-restored. A genuinely **new** plugin entity type would NOT
    be boot-restored at this host version — the host would need to iterate
    `host.listEntities()` instead of a hardcoded array.
  - **Brief drift — migration schema.** The brief suggested aligning the plugin's
    `database_table` schema to `id INTEGER PRIMARY KEY AUTOINCREMENT, slug TEXT UNIQUE`.
    That reflects the host's **superseded** migration `006`. The host's current
    authoritative schema (migration `035`, M29 — the last to touch this table) is
    `slug TEXT PRIMARY KEY`, which the plugin already matches, so the migration was left
    unchanged. Against a live host the table pre-exists anyway, so the plugin's
    `CREATE TABLE IF NOT EXISTS` is a no-op; the host's `RawEntityReader` only ever
    `SELECT … WHERE slug = ?` / `ORDER BY slug`, so nothing depends on `rowid`.
- **Frontend fetch prefix.** The host mounts routes under
  `/api/projects/:id/database-tables`, but the **client's source for `:id` is
  unspecified**. I read `window.__c4s_projectId` and fall back to
  `/api/database-tables`. This needs a real host-provided mechanism (import-map
  global, context, or a host fetch helper).

## Suggestion

Document the cross-cutting service contracts plugins may rely on at host API 1.0.0:
the tag store methods (read/set/clear per entity, and rename), the references service
`propagateSlugChange` signature, the entity file store `write/remove`, the
`RestoreContext.writer` upsert API, and how the **frontend** obtains the project id /
base URL. Until then plugins must guess these, which is fragile.

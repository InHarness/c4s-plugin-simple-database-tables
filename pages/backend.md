<!-- anchor: gklcet6v -->
# Backend (L1–L4)

The backend is mounted by `backend.mount(ctx)`; `ctx.app` already lives under `/api/projects/:id`, so
every path below is **relative to `pathPrefix` `/database-tables`** (no `/api`).

<!-- anchor: ycb8bt70 -->
## L1 — Migrations & schema

A single SQLite table backs the entity. `columns` and `indexes` are stored as JSON text columns;
soft-FKs are never enforced at the database level.

<single_element type="database-table" slug="database-table"/>

<!-- anchor: nrqufia2 -->
## L2 — Domain service

The domain service owns the business rules consumed by both the MCP server (L3) and the router (L4):

- **create** — `slug = slugify(name)`; soft-FK targets that do not exist are collected into
  `warnings[]` (never an error), so tables can be authored in any order.
- **update** — partial; a **rename** happens only via an explicit `newSlug`, which propagates to every
  `fk.table === oldSlug` and to all M19 references.
- **delete** — CASCADEs `entity_tag` rows; soft-FKs are not cascaded, dangling references are returned
  in `danglingFks[]`.
- **restore** — UPSERT by slug, replace `columns[]`/`indexes[]`, sync tags (see serialization).

The service exchanges these shapes:

<element_list type="dto" slugs="column-spec,index-spec,database-table-snapshot,database-table-list-item"/>

<!-- anchor: sajj4hli -->
## L3 — MCP server

Five CRUD tools (`create` / `get` / `list` / `update` / `delete`), registered as a **factory**
(`() => createServer`) rather than a shared instance, so each registration gets a fresh server (safe
under hot-reload).

<!-- anchor: y6sae0r0 -->
## L4 — Express Router

CRUD plus a restore route, all relative to `pathPrefix`:

<element_list type="endpoint" slugs="get-database-tables,get-database-tables-slug,post-database-tables,patch-database-tables-slug,delete-database-tables-slug,post-database-tables-slug-restore"/>

The list route returns the trimmed <inline_mention type="dto" slug="database-table-list-item"/>
(derived `columnCount` / `hasPrimaryKey`); every other route exchanges the full
<inline_mention type="dto" slug="database-table-snapshot"/>.

<!-- anchor: jsxi8qwp -->
# Serialization (L9)

L9 provides `snapshot` / `restore` / `diff`. The file on disk is the **source of truth** (M29), not
the SQLite row.

<!-- anchor: rvbwgjbw -->
## File format

Each entity is serialized to:

```
.claude4spec/entities/database-table/<slug>.json
```

The file content is a <inline_mention type="dto" slug="database-table-snapshot"/>:

<single_element type="dto" slug="database-table-snapshot"/>

<!-- anchor: 20zj1vx2 -->
## snapshot()

Reads the SQLite row plus its tag set and produces the full
<inline_mention type="dto" slug="database-table-snapshot"/> — the same shape as the `single_element`
detail payload, with `tags[]` appended.

<!-- anchor: lqos2ehf -->
## restore()

UPSERT by slug, replacing `columns[]` and `indexes[]` wholesale and syncing the tag set from the
snapshot. Two trigger modes:

- **boot / file-watch** — on startup and whenever a snapshot file changes on disk, the runtime restores
  it into SQLite (file → DB).
- **release restore** — restoring a named release replays its snapshots.

The HTTP surface for restore is <inline_mention type="endpoint" slug="post-database-tables-slug-restore"/>.

<!-- anchor: vwcno61f -->
## diff()

Compares two <inline_mention type="dto" slug="database-table-snapshot"/> values and reports added / removed / changed columns, indexes and
tags. Used by release diffing and by the file-watch reconciler to decide whether a restore is needed.

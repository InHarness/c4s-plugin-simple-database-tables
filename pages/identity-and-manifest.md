<!-- anchor: brwgx0re -->
# Identity & Manifest

<!-- anchor: 6phmiyg5 -->
## Entity identity

The plugin contributes a single entity type, `type="database-table"`:

- **slug** = `slugify(name)`, kebab-case; the primary key of every row.
- **SQLite table** = `database_table` (singular, snake_case). The table is deliberately **not** named
  `table` — that is a reserved SQL keyword.
- **pathPrefix** = `/database-tables` (declared on the `EntityModule`, without `/api`).

<single_element type="database-table" slug="database-table"/>

<!-- anchor: 0u1ag05p -->
## PluginManifest

The manifest declares **only** the entity contribution and the required M05 system-prompt block —
no `capabilities`:

```jsonc
{
  "name": "c4s-plugin-simple-database-tables",
  "version": "0.1.0",
  "hostApiVersion": "^1.0.0",
  "contributes": {
    "entities": ["database-table"]
    // no settings / commands / writingStyles
  }
}
```

<!-- anchor: bq0br64h -->
### Host API version contract

`hostApiVersion: "^1.0.0"` stays valid: the host is on **1.0.0** and the compatibility gate compares
the **major** only, so `^1.0.0` passes regardless of the minor. The proposed bump to 1.1.0 alongside
the UI kit was **rejected**; some docs carry conflicting version mentions, but the conclusion
(`^1.0.0` OK) holds in both readings.

<!-- anchor: a40f7kan -->
## Lifecycle

<!-- anchor: drn98yqh -->
### `onUnregister()`

Must be **idempotent** and must **never throw** — hot-reload tears the module down and re-registers it
repeatedly, so a throwing teardown would break reload. It releases the MCP server, unmounts the router,
and detaches frontend renderers.

<!-- anchor: 1vk3avy7 -->
## M05 — system-prompt requirement

The plugin ships the required M05 system-prompt fragment teaching the agent how the `database-table`
entity behaves (slug rules, soft-FK semantics, `database_table` naming). This is the one mandatory
non-`contributes` block.

<!-- anchor: doy3yf81 -->
# Simple Database Tables — Plugin Overview

This C4S project is the **specification** of a plugin that extracts the
`database-table` entity out of the base *C4S App Spec* into a standalone plugin built on
the **scaffold** described in *Plugins Docs*. The working loop is **spec → `release_create` → brief**
for an external Claude Code agent that writes the code. This repository contains **no plugin code** —
only the spec plus the implementation brief.

<!-- anchor: pjxwuu0x -->
## Scope (v0.1)

- Exactly **one** contributed entity: `database-table` (SQLite table `database_table`).
- **No `capabilities`** (no settings / commands / writingStyles) — the plugin contributes none.
  The manifest declares only `contributes.entities` plus the required M05 system-prompt.
- `hostApiVersion: "^1.0.0"` — the host stands on 1.0.0 and the compatibility gate compares the
  **major** only.

<!-- anchor: 9q1zac8d -->
## Origin & relationship to the scaffold

The implementing agent does **not** create the plugin layout from scratch — it bootstraps from the
scaffold via **degit**:

```
npx degit InHarness/c4s-plugin-scaffold c4s-plugin-simple-database-tables
```

The scaffold slots **L1–L9** and **M05** map 1:1 onto files/directories; the agent fills them in
rather than designing the layout. Path convention: `ctx.app` is mounted by the host under
`/api/projects/:id`, the plugin declares only `pathPrefix = "/database-tables"` (no `/api`), so the
effective full path is `/api/projects/:id/database-tables/...`.

<!-- anchor: p85ryupz -->
## Slot map (L1–L9 → pages)

| Slot | Concern | Page |
| --- | --- | --- |
| L1 | SQLite migrations + schema | backend |
| L2 | Domain service | backend |
| L3 | MCP server (5 CRUD tools, factory) | backend |
| L4 | Express Router (CRUD + restore) | backend |
| L5 / L8 | List view, chips, detail panel (Host UI Kit) | frontend |
| L5-ui | Project-scoped fetch (M33) — `/api/projects/<id>/...` from `window.__C4S_PROJECT__.id` | frontend |
| L12 | Host UI Kit components (M34) — `EntityListHeader`/`DetailPanelShell` stable, `TagFilterBar`/`EntityListRow` experimental | frontend |
| L9 | snapshot / restore / diff | serialization |
| M05 | System-prompt requirement | identity-and-manifest |

<!-- anchor: ymjnaj78 -->
## The contributed entity

<single_element type="database-table" slug="database-table"/>

<!-- anchor: 0p4lumns -->
## Reading order

1. Identity & manifest — entity identity, `PluginManifest`, `onUnregister`, host API version.
2. Backend — L1–L4.
3. Frontend — L5/L8 + Host UI Kit.
4. Serialization — L9.
5. Acceptance criteria — the observable contract.

<!-- anchor: 0yt8fmx0 -->
# Frontend (L5 / L8)

The frontend contributes chips, a list view and a detail panel. All renderers are
**pure-presentational** React: props-in, no `useEditor()`, no `useQuery()`, no fetch inside the
component. Data resolution is host-injected through `useGetBySlug` (`use__EntityName__BySlug`).

<!-- anchor: kzfimznt -->
## L8 — Chips (renderChip / renderCard / renderRow)

`renderChip`, `renderCard` and `renderRow` stay pure-presentational with the host-resolver. `renderRow`
renders a single row only — `FrontendModule` has **no** list-header/container slot, so the list header
(`EntityListHeader`) is host territory.

<!-- anchor: or442opy -->
## L5 — List view

<single_element type="ui-view" slug="database-table-list"/>

Each row is the plugin's `renderRow`: name + a column-count badge + description. The slash command
**`/database-table`** (slug-aligned, not `/dbtable`) inserts a reference into a page.

<!-- anchor: 1s2mpno9 -->
## L5 / L8 — Detail panel (Host UI Kit)

<single_element type="ui-view" slug="database-table-detail-panel"/>

The detail panel is framed with the **Host UI Kit** (L12 / M34), imported from
`@c4s/plugin-runtime/ui` (re-exported through `src/host.ts`):

- **`DetailPanelShell`** — frame + breadcrumb, **no `title` prop** (the header is the last breadcrumb
  segment).
- **`FieldGrid` / `FieldRow`** — `FieldRow` takes the value as **`children`**, **not** a `value` prop.

These three are the `stable`-tier components. The kit removes manual *chrome* (header/scaffold) but
**not** the data layer: the panel still self-fetches via the plugin's registered `useGetBySlug` (we do
**not** use the example's `useEntity`, which is the M20 embed hook and misleading in this context). The
token bridge exposes the resolved `c4s-paper-terra` design-system tokens as `--c-*` CSS vars, honoring
theme modes.

<!-- anchor: cfu9vdcx -->
### Build & dependency requirements

- **Vite externalize:** `@c4s/plugin-runtime/ui` must be in `rollupOptions.external` — the plugin does
  not bundle its own copy of the host UI. No smoke test is required for the kit (host infrastructure).
- **`peerDependencies`:** no new key — the subpath ships with the already-declared
  `@c4s/plugin-runtime` peer.
- **Manifest / `contributes` / `capabilities`:** unchanged — the kit is consumed *inside* the existing
  `detailPanel`, it is not something the plugin contributes.

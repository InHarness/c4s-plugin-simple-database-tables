<!-- anchor: 0yt8fmx0 -->
# Frontend (L5 / L8)

The frontend contributes chips, a list view and a detail panel. All renderers are
**pure-presentational** React: props-in, no `useEditor()`, no `useQuery()`, no fetch inside the
component. Data resolution is host-injected through `useGetBySlug` (`use__EntityName__BySlug`): the
host **invokes** the resolver, but the **plugin composes the URL** — and that URL must be
project-scoped (see <section_ref anchor="0cvw9vcj"/>). The host does **not** prefix the
plugin's data fetches.

<!-- anchor: 0cvw9vcj -->
## Project-scoped fetch (M33 / L5-ui)

Every plugin **data fetch** MUST build a project-scoped URL of the form
`/api/projects/<id>/database-tables/...`, where `<id> = window.__C4S_PROJECT__.id`. A bare `/api/...`
request resolves to **404** — a loud failure, never a silent degradation.

- **Routing ≠ fetch.** The host applies an auto-basepath **only** to client navigation (the route tree
  mounted through `host.mountFrontend`). Data fetching is a separate path and requires the plugin to add
  the project prefix explicitly.
- **No host helper yet.** There is no host-provided `projectId` / `apiFetch` accessor; the plugin reads
  the id directly with the fallback `window.__C4S_PROJECT__?.id ?? 'default'`. When such a helper
  eventually ships it would land on the versioned `hostApiVersion` surface.
- **Timing.** The global is injected before React mounts, so it is available at the moment a chip, card
  or detail panel renders.

The rule holds regardless of the resolver's name: `useGetBySlug` is the M13 data-resolver concept, not
an M33 contract, but any hook that fetches plugin data must apply the project prefix.

<!-- anchor: kzfimznt -->
## L8 — Chips (renderChip / renderCard / renderRow)

`renderChip`, `renderCard` and `renderRow` stay pure-presentational with the host-resolver. `renderRow`
renders a single row only — `FrontendModule` has **no** list-header/container slot, so the list header
(`EntityListHeader`) is never part of `renderRow`; it belongs to the plugin's own `frontend.routes` list
route (see <section_ref anchor="or442opy"/>).

**Styling via host tokens.** Even though the chip / card / row are hand-written markup (not Host UI Kit
components), they MUST style themselves with the host **`--c-*` CSS vars** exposed by the token bridge
(the same `c4s-paper-terra` design-system variables consumed in `frontend.routes`, see
<section_ref anchor="1s2mpno9"/>) — e.g. `var(--c-bg)`, `var(--c-fg)`, `var(--c-muted)`,
`var(--c-border)`. A renderer that emits bare unstyled elements (no `style` / `className` referencing
`--c-*`) renders **"naked"** inside the host — embeds such as `<single_element type="database-table"/>`
then show no visual framing. Use the tokens rather than hard-coded colors so theme modes keep working.

<!-- anchor: or442opy -->
## L5 — List view

<single_element type="ui-view" slug="database-table-list"/>

`renderRow` is rendered through **`EntityListRow`** (Host UI Kit, L12 / M34) instead of hand-written
markup: `title` is required, with the column count passed as `meta` and the description as `subtitle`
(`icon?`, `actions?`, `children?` are the remaining `ReactNode` slots). The slash command
**`/database-table`** (slug-aligned, not `/dbtable`) inserts a reference into a page.

The plugin's own list route (`frontend.routes`) composes the full native sequence:
**`EntityListHeader` → search → `TagFilterBar` → `EntityListRow`**. `TagFilterBar` (`tags`, `selected`,
`onToggle`, `mode`, `onModeChange?`) renders each tag chip via the existing `Badge`. The "N results"
counter is the **`count`** prop on `EntityListHeader` — there is no separate `CountBadge`.

`FrontendModule` still has **no** list-header/container slot: `EntityListHeader` lives only inside the
plugin's own `frontend.routes` list route, never inside `renderRow`.

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
**not** use the example's `useEntity`, which is the M20 embed hook and misleading in this context). That
self-fetch must be **project-scoped** — the panel composes `/api/projects/<id>/database-tables/...` from
`window.__C4S_PROJECT__.id`; the host does not prefix it (see <section_ref anchor="0cvw9vcj"/>). The
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

**Component tiers.** The kit splits into two stability tiers:

- **`stable`** — frozen, part of `hostApiVersion`; a breaking change is a major bump plus `migrations[]`:
  `EntityListHeader`, `DetailPanelShell`, `FieldGrid`, `FieldRow`.
- **`experimental`** — props may change without a major, ungated, opt-in: `TagFilterBar`,
  `EntityListRow`. Adopting them is a deliberate decision that accepts an unstable contract.

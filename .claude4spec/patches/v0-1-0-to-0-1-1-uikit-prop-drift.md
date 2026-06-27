---
type: patch
brief: v0-1-0-to-0-1-1.md
patch_kind: drift
created_at: 2026-06-26T00:00:00Z
created_by: claude-code
---

# Patch — EntityListRow / TagFilterBar prop shapes drift from the brief; no plugin-reachable tag catalog

## What I found

The brief (sections 2 and "For implementers" 2–3) describes prop shapes for the two
experimental-tier Host UI Kit components that **do not match the installed
`@c4s/plugin-runtime/ui`** (host source `src/client/host-ui-kit/list/*`). Implementing
the brief's prop names verbatim would not compile.

**`EntityListRow`** — the brief says map `title={name}`, `meta={columnCount}`,
`subtitle={description}` (plus `icon?`/`actions?`/`children?`). The actual
`EntityListRowProps` has **none** of those props:

```ts
interface EntityListRowProps {
  leading: React.ReactNode;        // required
  onClick: () => void;             // required
  tags?: string[];                 // tag SLUGS
  tagLookup: Map<string, Tag>;     // required — resolves slugs → name/color
  trailing?: React.ReactNode;
  align?: 'center' | 'start';
  style?: React.CSSProperties;
  children: React.ReactNode;       // required
}
```

So content goes into `leading` / `children` / `trailing`, and a **required**
`tagLookup` Map must be supplied. I mapped: `leading` = table glyph, `children` =
name + description, `trailing` = column count.

**`TagFilterBar`** — the brief says props `tags`, `selected`, `onToggle`, `mode`,
`onModeChange?`. The actual interface (`TagBarProps`) is:

```ts
interface TagBarProps {
  tags: Tag[];                       // Tag OBJECTS, not string[]
  tagFilter: string[];               // (brief's `selected`)
  onTagToggle: (slug: string) => void; // (brief's `onToggle`)
  tagMode: 'and' | 'or';             // (brief's `mode`)
  onToggleMode: () => void;          // (brief's `onModeChange`)
  onClear: () => void;               // required — not mentioned in the brief
}
```

`tags` is `Tag[]` (`{ slug, name, color, description, counts, createdAt, updatedAt }`),
not `string[]`. `onClear` is required and absent from the brief.

**No plugin-reachable tag catalog.** Both components need real `Tag` objects, but
`@c4s/plugin-runtime` / `@c4s/plugin-runtime/ui` export **no** `useTags` hook or tag
accessor, and `window.__C4S_PROJECT__` carries only `{ id, name }`. The host populates
these props from its internal `GET /api/tags` + `useTags()` (`useEntityListQuery`),
which is not surfaced to plugins. I derived the tag universe from the list items' own
`tags` slugs and synthesized placeholder `Tag` objects (`name = slug`, `color = null`).
This works but is degraded: no real tag display names or colors, and tags with zero
matching tables never appear.

`Tag`, `EntityListRowProps`, and `TagBarProps` are also not published as types, so I
added ambient declarations to `src/c4s-runtime.d.ts` alongside the existing stable-tier
declarations.

## Suggestion

For the next brief / entity edits, consider:

1. **Correct the documented prop shapes** for `EntityListRow` (`leading`/`onClick`/
   `tagLookup`/`trailing`/`children`) and `TagFilterBar` (`tagFilter`/`onTagToggle`/
   `tagMode`/`onToggleMode`/`onClear`, `tags: Tag[]`), so implementers wire them
   correctly the first time. Note `tagLookup` and `onClear` are required.
2. **Specify the tag-catalog source.** Either document a host-provided accessor
   (a re-exported `useTags` / `projectTags` on the versioned `hostApiVersion` surface)
   or a project-scoped endpoint (e.g. `GET /api/projects/<id>/tags`) returning the full
   `Tag[]` with names + colors. Without one, any plugin adopting `TagFilterBar` /
   `EntityListRow` must synthesize placeholder tags from list-item slugs (degraded).
3. **Publish the `Tag` type** (and the experimental component prop types) so plugins
   don't have to hand-mirror them in an ambient `.d.ts`.

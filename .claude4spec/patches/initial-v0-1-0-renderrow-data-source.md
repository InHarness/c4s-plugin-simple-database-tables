---
type: patch
brief: initial-v0-1-0.md
patch_kind: drift
created_at: 2026-06-24T00:00:00Z
created_by: claude-code
---

# Patch — renderRow/chip/card data source: injected `entity`, not `useGetBySlug`

## What I found

AC4 and the Frontend page state that the list view's `renderRow` "resolves data
**only through host-injected `useGetBySlug`**, and never calls `useEditor()`". The
real host 1.0.0 contract (the scaffold targets it, `HOST_API_VERSION = 1.0.0`)
**injects the already-resolved entity into chip/card/row via props**:

- `EntityChipProps` / `EntityCardProps` = `{ slug, entity, onOpen }`
- `EntityRowProps` = `{ entity, active, onOpen }`

`useGetBySlug` (`use__EntityName__BySlug`) is a **module-level `FrontendModule` slot**
that the host calls to resolve data and that the **detail panel** uses to self-fetch —
it is NOT called from inside chip/card/row. Those components are pure-presentational
and receive `entity` directly; `entity === null` means a broken reference.

I implemented the renderers per the real host contract: `renderRow` is pure, reads
the injected `entity` prop (name + column-count badge + description), never calls
`useEditor()`. The plugin still registers `useGetBySlug`/`listByTags` as module slots,
and the detail panel self-fetches through `useGetBySlug` (matches the brief's detail
section).

## Suggestion

Reword AC4 / the Frontend page so the data-resolution rule reads: "chip/card/row are
pure-presentational and consume the **host-injected `entity` prop** (never self-fetch,
never `useEditor()`); `useGetBySlug` is the module-level resolver slot the host uses
and the detail panel self-fetches with." This keeps the (correct) intent — pure
renderers, host-owned data resolution — while matching the actual prop contract.

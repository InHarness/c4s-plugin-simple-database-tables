---
type: patch
brief: initial-v0-1-0.md
patch_kind: clarification
created_at: 2026-06-24T00:00:00Z
created_by: claude-code
---

# Patch — list endpoint response shape: bare array vs `{ items }`

## What I found

The brief's HTTP table says `GET /database-tables` returns
`DatabaseTableListItem[]` (a **bare array**). The scaffold's hand-written router and
its frontend `listByTags` hook use the convention `{ items: DatabaseTableListItem[] }`
(an envelope). The two disagree.

I followed the brief: `GET /database-tables` returns a **bare array**. To stay
compatible with hosts/clients that expect the envelope, I made the frontend
`listDatabaseTableByTags` hook **tolerant** — it accepts either a bare array or a
`{ items }` wrapper.

## Suggestion

Pick one shape and state it explicitly in the endpoint spec (and the M19/host list
contract). If the host's list views expect `{ items, total }` for pagination, the
brief should say so; otherwise confirm the bare array is canonical so plugins don't
each guess. Today the brief and the scaffold imply different shapes.

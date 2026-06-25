/**
 * L9 — `EntitySerializer` for `database-table`. `snapshot()` defines the on-disk
 * entity file format (`.claude4spec/entities/database-table/<slug>.json`, committed —
 * the source of truth, M29). The file content is a `DatabaseTableSnapshot`.
 *
 *  - snapshot(): SQLite row + tag set → full DatabaseTableSnapshot (tags[] appended).
 *  - restore():  UPSERT by slug, replacing columns[]/indexes[] wholesale and syncing
 *    tags; triggered on boot/file-watch (file → DB) and on named-release restore.
 *  - diff():     added/removed/changed columns, indexes and tags between two snapshots.
 *
 * Column/index order is semantic (ordered) and preserved; only `tags` is sorted for
 * a deterministic committed file.
 */

import type {
  EntitySerializer,
  EntityDiff,
  RestoreContext,
  RestoreResult,
  SnapshotData,
} from '../host';
import { DB_TABLE_ENTITY_TYPE } from '../identity';
import {
  deriveIndexName,
  type ColumnSpec,
  type IndexSpec,
  type DatabaseTableListItem,
  type DatabaseTableSnapshot,
} from './dto';

// The host passes a RawEntity: { slug, data: {...}, tags: [...] }.
function toSnapshot(entity: any): DatabaseTableSnapshot {
  const data = (entity?.data ?? entity ?? {}) as Partial<DatabaseTableSnapshot>;
  const tags = Array.isArray(entity?.tags) ? [...entity.tags].sort() : data.tags;
  return {
    slug: String(entity?.slug ?? data.slug ?? ''),
    name: String(data.name ?? ''),
    description: data.description,
    columns: Array.isArray(data.columns) ? (data.columns as ColumnSpec[]) : [],
    indexes: Array.isArray(data.indexes) ? (data.indexes as IndexSpec[]) : [],
    tags: tags ? [...tags].sort() : undefined,
    created_at: data.created_at,
    updated_at: data.updated_at,
  };
}

function toListItem(entity: any): DatabaseTableListItem {
  const snap = toSnapshot(entity);
  return {
    slug: snap.slug,
    name: snap.name,
    description: snap.description,
    columnCount: snap.columns.length,
    hasPrimaryKey: snap.columns.some((c) => c.pk === true),
    tags: snap.tags,
  };
}

const indexKey = (i: IndexSpec) => deriveIndexName(DB_TABLE_ENTITY_TYPE, i);

export const databaseTableSerializer: EntitySerializer = {
  type: DB_TABLE_ENTITY_TYPE,
  version: '1.0.0',

  // ─── L9 views (XML) ───
  inlineMention: (entity: any) => ({
    type: DB_TABLE_ENTITY_TYPE,
    slug: entity?.slug,
    label: entity?.data?.name ?? entity?.slug,
    href: `/database-tables/${entity?.slug}`,
  }),
  singleElement: (entity: any) => toSnapshot(entity),
  elementListItem: (entity: any) => toListItem(entity),
  taggedListItem: (entity: any) => toListItem(entity),
  detail: (entity: any) => toSnapshot(entity),

  // ─── M17 snapshot / restore / diff ───
  snapshot: (entity: any) => toSnapshot(entity),

  restore: (data: SnapshotData, ctx: RestoreContext): RestoreResult => {
    const snap = data as DatabaseTableSnapshot;
    // UPSERT by slug through the host writer (replaces columns[]/indexes[] wholesale),
    // then sync the tag set. `ctx.writer` is the host's `HostEntityWriter`; the ambient
    // type is `unknown`, so narrow to the two methods we use. Mirrors the host's
    // canonical database-table restore — the writer routes upsertDatabaseTable() to
    // our service.upsert() and entityExists()-gates syncTags(), so the row must be
    // upserted before tags are synced.
    const writer = ctx.writer as {
      upsertDatabaseTable: (
        slug: string,
        input: {
          name: string;
          description?: string;
          columns: ColumnSpec[];
          indexes: IndexSpec[];
          slug: string;
        },
        actor: 'user' | 'agent',
      ) => { op: 'created' | 'updated'; entity: DatabaseTableSnapshot | null; warnings?: string[] };
      syncTags: (type: string, slug: string, tags: string[]) => void;
    };
    const result = writer.upsertDatabaseTable(
      snap.slug,
      {
        name: snap.name,
        description: snap.description ?? undefined,
        columns: snap.columns ?? [],
        indexes: snap.indexes ?? [],
        slug: snap.slug,
      },
      ctx.actor,
    );
    writer.syncTags(DB_TABLE_ENTITY_TYPE, snap.slug, snap.tags ?? []);
    return {
      op: result.op,
      entity: result.entity,
      ...(result.warnings && result.warnings.length ? { warnings: result.warnings } : {}),
    };
  },

  diff: (a: SnapshotData, b: SnapshotData, slug: string): EntityDiff => {
    if (a == null && b == null) return { type: DB_TABLE_ENTITY_TYPE, slug, op: 'noop' };
    if (a == null) return { type: DB_TABLE_ENTITY_TYPE, slug, op: 'created' };
    if (b == null) return { type: DB_TABLE_ENTITY_TYPE, slug, op: 'deleted' };

    const sa = a as DatabaseTableSnapshot;
    const sb = b as DatabaseTableSnapshot;
    const changes: Record<string, unknown> = {};

    if (sa.name !== sb.name) changes.name = { from: sa.name, to: sb.name };
    if ((sa.description ?? '') !== (sb.description ?? ''))
      changes.description = { from: sa.description, to: sb.description };

    const columnDiff = diffByKey(sa.columns ?? [], sb.columns ?? [], (c) => c.name);
    if (columnDiff) changes.columns = columnDiff;

    const indexDiff = diffByKey(sa.indexes ?? [], sb.indexes ?? [], indexKey);
    if (indexDiff) changes.indexes = indexDiff;

    const tagsA = new Set(sa.tags ?? []);
    const tagsB = new Set(sb.tags ?? []);
    const tagsAdded = [...tagsB].filter((t) => !tagsA.has(t)).sort();
    const tagsRemoved = [...tagsA].filter((t) => !tagsB.has(t)).sort();
    if (tagsAdded.length || tagsRemoved.length)
      changes.tags = { added: tagsAdded, removed: tagsRemoved };

    return Object.keys(changes).length
      ? { type: DB_TABLE_ENTITY_TYPE, slug, op: 'modified', changes }
      : { type: DB_TABLE_ENTITY_TYPE, slug, op: 'noop' };
  },
};

/** added / removed / changed for an ordered list keyed by a stable identifier. */
function diffByKey<T>(
  a: T[],
  b: T[],
  keyOf: (item: T) => string,
): { added: string[]; removed: string[]; changed: string[] } | null {
  const mapA = new Map(a.map((x) => [keyOf(x), x]));
  const mapB = new Map(b.map((x) => [keyOf(x), x]));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const k of mapB.keys()) if (!mapA.has(k)) added.push(k);
  for (const k of mapA.keys()) if (!mapB.has(k)) removed.push(k);
  for (const [k, va] of mapA) {
    const vb = mapB.get(k);
    if (vb !== undefined && JSON.stringify(va) !== JSON.stringify(vb)) changed.push(k);
  }
  if (!added.length && !removed.length && !changed.length) return null;
  return { added: added.sort(), removed: removed.sort(), changed: changed.sort() };
}

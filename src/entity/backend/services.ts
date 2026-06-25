/**
 * L2 — the `database-table` domain service. Built in `backend.mount(ctx)` from
 * `ctx.db` (better-sqlite3) and the cross-cutting deps (tags / references /
 * entityStore). Consumed by both the MCP server (L3) and the Express router (L4).
 *
 * Business rules (from the brief):
 *  - create: slug = slugify(name); dangling soft-FK targets → warnings[] (never an
 *    error), so tables can be authored in any order.
 *  - update: partial; a RENAME happens only via an explicit `newSlug`, which
 *    propagates to every `fk.table === oldSlug` and to all M19 references.
 *  - delete: CASCADEs the table's entity_tag rows; soft-FKs are NOT cascaded —
 *    references that pointed at the deleted slug are returned in danglingFks[].
 *  - restore: UPSERT by slug — replaces columns[]/indexes[] wholesale and syncs tags.
 *
 * SQLite is a cache; the on-disk snapshot file is the source of truth (M29). DB
 * writes are concrete; host-owned side effects (tag sync, reference propagation,
 * entity-file persistence) are invoked defensively — their method names belong to
 * the host runtime, so each call is capability-checked and never throws on absence.
 */

import type { MountContext } from '../../host';
import { DB_TABLE_SQLITE_TABLE, DB_TABLE_ENTITY_TYPE, slugify } from '../../identity';
import type {
  ColumnSpec,
  IndexSpec,
  DatabaseTableSnapshot,
  DatabaseTableListItem,
  FkWarning,
  DanglingFk,
} from '../dto';

interface DbRow {
  slug: string;
  name: string;
  description: string | null;
  columns: string; // JSON
  indexes: string; // JSON
  created_at: string;
  updated_at: string;
}

export interface CreateDatabaseTableInput {
  name: string;
  description?: string;
  columns?: ColumnSpec[];
  indexes?: IndexSpec[];
  /** Optional explicit slug; normally derived as slugify(name). */
  slug?: string;
  tags?: string[];
}

export interface UpdateDatabaseTableInput {
  name?: string;
  description?: string;
  columns?: ColumnSpec[];
  indexes?: IndexSpec[];
  /** The ONLY way to rename — moves the slug and propagates references. */
  newSlug?: string;
  tags?: string[];
}

export interface ListQuery {
  tags?: string[];
  tagFilter?: 'and' | 'or';
  search?: string;
  limit?: number;
  offset?: number;
}

const T = DB_TABLE_SQLITE_TABLE;

export class DatabaseTableService {
  constructor(
    private readonly db: MountContext['db'],
    private readonly ctx: MountContext,
  ) {}

  // ─────────────────────────── reads ───────────────────────────

  getBySlug(slug: string): DatabaseTableSnapshot | null {
    const row = this.db.prepare(`SELECT * FROM ${T} WHERE slug = ?`).get(slug) as
      | DbRow
      | undefined;
    if (!row) return null;
    return this.rowToSnapshot(row);
  }

  /** Returns trimmed list items with derived columnCount / hasPrimaryKey. */
  list(query: ListQuery = {}): DatabaseTableListItem[] {
    let sql = `SELECT * FROM ${T}`;
    const params: unknown[] = [];
    if (query.search && query.search.trim()) {
      sql += ` WHERE name LIKE ? OR description LIKE ?`;
      const like = `%${query.search.trim()}%`;
      params.push(like, like);
    }
    sql += ` ORDER BY name ASC`;
    if (query.limit != null) {
      sql += ` LIMIT ?`;
      params.push(query.limit);
      if (query.offset != null) {
        sql += ` OFFSET ?`;
        params.push(query.offset);
      }
    }
    let rows = this.db.prepare(sql).all(...params) as DbRow[];

    // Optional tag filtering (host-owned tag store; capability-checked).
    if (query.tags && query.tags.length) {
      const filter = query.tagFilter ?? 'or';
      rows = rows.filter((row) => {
        const tags = this.tags.get(row.slug);
        return filter === 'and'
          ? query.tags!.every((t) => tags.includes(t))
          : query.tags!.some((t) => tags.includes(t));
      });
    }

    return rows.map((row) => {
      const columns = this.parseColumns(row.columns);
      return {
        slug: row.slug,
        name: row.name,
        description: row.description ?? undefined,
        columnCount: columns.length,
        hasPrimaryKey: columns.some((c) => c.pk === true),
        tags: this.tags.get(row.slug),
      };
    });
  }

  // ─────────────────────────── create ───────────────────────────

  create(
    input: CreateDatabaseTableInput,
    _actor: 'user' | 'agent' = 'user',
  ): { snapshot: DatabaseTableSnapshot; warnings: FkWarning[] } {
    if (!input.name || !input.name.trim()) {
      throw new Error('`name` is required to create a database-table');
    }
    const slug = input.slug?.trim() ? slugify(input.slug) : slugify(input.name);
    const columns = input.columns ?? [];
    const indexes = input.indexes ?? [];
    const now = new Date().toISOString();

    const warnings = this.fkWarnings(columns, slug);

    this.db
      .prepare(
        `INSERT INTO ${T} (slug, name, description, columns, indexes, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        slug,
        input.name,
        input.description ?? null,
        JSON.stringify(columns),
        JSON.stringify(indexes),
        now,
        now,
      );

    const snapshot: DatabaseTableSnapshot = {
      slug,
      name: input.name,
      description: input.description,
      columns,
      indexes,
      tags: input.tags,
      created_at: now,
      updated_at: now,
    };
    this.tags.sync(slug, input.tags);
    this.persist(snapshot);
    return { snapshot: { ...snapshot, tags: this.tags.get(slug) }, warnings };
  }

  // ─────────────────────────── update ───────────────────────────

  /**
   * Partial update. A `name`/`description`/`columns`/`indexes` change never moves
   * the slug. A rename happens ONLY via `newSlug` — it rewrites the PK, propagates
   * to every other row's `fk.table === oldSlug`, and propagates M19 references.
   */
  update(
    slug: string,
    patch: UpdateDatabaseTableInput,
    _actor: 'user' | 'agent' = 'user',
  ): { snapshot: DatabaseTableSnapshot; previousSlug: string; warnings: FkWarning[] } {
    const existing = this.getRow(slug);
    if (!existing) throw new Error(`database-table '${slug}' not found`);

    const previousSlug = slug;
    const nextSlug = patch.newSlug?.trim() ? slugify(patch.newSlug) : slug;
    const name = patch.name ?? existing.name;
    const description =
      patch.description !== undefined ? patch.description : existing.description ?? undefined;
    const columns = patch.columns ?? this.parseColumns(existing.columns);
    const indexes = patch.indexes ?? this.parseIndexes(existing.indexes);
    const now = new Date().toISOString();

    const warnings = this.fkWarnings(columns, nextSlug);

    this.db
      .prepare(
        `UPDATE ${T}
            SET slug = ?, name = ?, description = ?, columns = ?, indexes = ?, updated_at = ?
          WHERE slug = ?`,
      )
      .run(
        nextSlug,
        name,
        description ?? null,
        JSON.stringify(columns),
        JSON.stringify(indexes),
        now,
        previousSlug,
      );

    if (nextSlug !== previousSlug) {
      this.propagateRename(previousSlug, nextSlug);
      this.tags.rename(previousSlug, nextSlug);
    }
    if (patch.tags !== undefined) this.tags.sync(nextSlug, patch.tags);

    const snapshot: DatabaseTableSnapshot = {
      slug: nextSlug,
      name,
      description,
      columns,
      indexes,
      tags: this.tags.get(nextSlug),
      created_at: existing.created_at,
      updated_at: now,
    };
    if (nextSlug !== previousSlug) this.removeFile(previousSlug);
    this.persist(snapshot);
    return { snapshot, previousSlug, warnings };
  }

  // ─────────────────────────── delete ───────────────────────────

  /**
   * Delete by slug. CASCADEs the table's entity_tag rows; soft-FKs are NOT
   * cascaded — every reference that pointed at this slug is returned in danglingFks.
   */
  remove(slug: string, _actor: 'user' | 'agent' = 'user'): { deleted: boolean; danglingFks: DanglingFk[] } {
    const existing = this.getRow(slug);
    if (!existing) return { deleted: false, danglingFks: [] };

    const danglingFks = this.danglingFksTo(slug);

    this.db.prepare(`DELETE FROM ${T} WHERE slug = ?`).run(slug);
    this.tags.clear(slug); // CASCADE entity_tag rows
    this.removeFile(slug);
    return { deleted: true, danglingFks };
  }

  // ─────────────────────────── upsert (boot / restore) ───────────────────────────

  /**
   * UPSERT by slug from a full snapshot — INSERT when absent, otherwise UPDATE
   * name/description/columns/indexes wholesale. This is the method the host's
   * `HostEntityWriter.upsertDatabaseTable` invokes during boot/file-watch reindex.
   *
   * The slug is used VERBATIM (never re-derived) because it is the entity identity on
   * the restore path. Tag sync is NOT done here — on the boot path the host writer's
   * `syncTags` owns it; the HTTP `restore()` below syncs tags itself. `opts.writeFile
   * === false` skips the plugin's own file write (the host orchestrates files during
   * the index rebuild); `opts.capture` is accepted for parity with the host contract
   * but unused (this SQLite cache keeps no version log). `warnings` are strings to
   * match the host's `UpsertResult.warnings: string[]`.
   */
  upsert(
    slug: string,
    input: CreateDatabaseTableInput,
    _actor: 'user' | 'agent' = 'user',
    opts: { capture?: boolean; writeFile?: boolean } = {},
  ): { dbTable: DatabaseTableSnapshot; op: 'created' | 'updated'; warnings: string[] } {
    const existing = this.getRow(slug);
    const now = new Date().toISOString();
    const columns = input.columns ?? [];
    const indexes = input.indexes ?? [];
    const warnings = this.fkWarnings(columns, slug).map((w) => w.message);

    if (existing) {
      this.db
        .prepare(
          `UPDATE ${T}
              SET name = ?, description = ?, columns = ?, indexes = ?, updated_at = ?
            WHERE slug = ?`,
        )
        .run(
          input.name,
          input.description ?? null,
          JSON.stringify(columns),
          JSON.stringify(indexes),
          now,
          slug,
        );
    } else {
      this.db
        .prepare(
          `INSERT INTO ${T} (slug, name, description, columns, indexes, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          slug,
          input.name,
          input.description ?? null,
          JSON.stringify(columns),
          JSON.stringify(indexes),
          now,
          now,
        );
    }

    const dbTable: DatabaseTableSnapshot = {
      slug,
      name: input.name,
      description: input.description,
      columns,
      indexes,
      tags: this.tags.get(slug),
      created_at: existing ? existing.created_at : now,
      updated_at: now,
    };
    if (opts.writeFile !== false) this.persist(dbTable);
    return { dbTable, op: existing ? 'updated' : 'created', warnings };
  }

  // ─────────────────────────── restore ───────────────────────────

  /**
   * UPSERT by slug from a full snapshot — delegates to `upsert()`, then syncs the tag
   * set (the HTTP restore path owns its own tag sync; the boot path goes through the
   * host writer's `syncTags` instead). Triggered on the L4 `POST /:slug/restore` route.
   */
  restore(
    snapshot: DatabaseTableSnapshot,
    actor: 'user' | 'agent' = 'user',
  ): { op: 'created' | 'updated'; snapshot: DatabaseTableSnapshot } {
    const { dbTable, op } = this.upsert(
      snapshot.slug,
      {
        name: snapshot.name,
        description: snapshot.description,
        columns: snapshot.columns ?? [],
        indexes: snapshot.indexes ?? [],
        slug: snapshot.slug,
        tags: snapshot.tags,
      },
      actor,
    );
    this.tags.sync(snapshot.slug, snapshot.tags ?? []);
    return { op, snapshot: { ...dbTable, tags: this.tags.get(snapshot.slug) } };
  }

  // ─────────────────────────── helpers ───────────────────────────

  private getRow(slug: string): DbRow | undefined {
    return this.db.prepare(`SELECT * FROM ${T} WHERE slug = ?`).get(slug) as DbRow | undefined;
  }

  private allRows(): DbRow[] {
    return this.db.prepare(`SELECT * FROM ${T}`).all() as DbRow[];
  }

  private parseColumns(json: string): ColumnSpec[] {
    try {
      const v = JSON.parse(json ?? '[]');
      return Array.isArray(v) ? (v as ColumnSpec[]) : [];
    } catch {
      return [];
    }
  }

  private parseIndexes(json: string): IndexSpec[] {
    try {
      const v = JSON.parse(json ?? '[]');
      return Array.isArray(v) ? (v as IndexSpec[]) : [];
    } catch {
      return [];
    }
  }

  private rowToSnapshot(row: DbRow): DatabaseTableSnapshot {
    return {
      slug: row.slug,
      name: row.name,
      description: row.description ?? undefined,
      columns: this.parseColumns(row.columns),
      indexes: this.parseIndexes(row.indexes),
      tags: this.tags.get(row.slug),
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  /** Soft-FK targets that don't (yet) exist → warnings (never errors). */
  private fkWarnings(columns: ColumnSpec[], selfSlug: string): FkWarning[] {
    const existing = new Set(this.allRows().map((r) => r.slug));
    existing.add(selfSlug); // a self-referential FK is fine
    const warnings: FkWarning[] = [];
    for (const col of columns) {
      if (col.fk?.table && !existing.has(col.fk.table)) {
        warnings.push({
          column: col.name,
          table: col.fk.table,
          message: `Column '${col.name}' references unknown table '${col.fk.table}' (soft-FK; create it later).`,
        });
      }
    }
    return warnings;
  }

  /** Every reference (from any other table) that points at `slug`. */
  private danglingFksTo(slug: string): DanglingFk[] {
    const out: DanglingFk[] = [];
    for (const row of this.allRows()) {
      if (row.slug === slug) continue;
      for (const col of this.parseColumns(row.columns)) {
        if (col.fk?.table === slug) {
          out.push({ fromTable: row.slug, column: col.name, toTable: slug });
        }
      }
    }
    return out;
  }

  /** On rename, repoint every `fk.table === oldSlug` and propagate M19 references. */
  private propagateRename(oldSlug: string, newSlug: string): void {
    for (const row of this.allRows()) {
      if (row.slug === newSlug) continue;
      const columns = this.parseColumns(row.columns);
      let changed = false;
      for (const col of columns) {
        if (col.fk?.table === oldSlug) {
          col.fk.table = newSlug;
          changed = true;
        }
      }
      if (changed) {
        this.db
          .prepare(`UPDATE ${T} SET columns = ? WHERE slug = ?`)
          .run(JSON.stringify(columns), row.slug);
      }
    }
    // M19 — propagate XML references across pages (host-owned service).
    const refs = this.ctx.referencesService as
      | { propagateSlugChange?: (type: string, from: string, to: string) => unknown }
      | undefined;
    try {
      refs?.propagateSlugChange?.(DB_TABLE_ENTITY_TYPE, oldSlug, newSlug);
    } catch {
      /* host-specific; never block the rename */
    }
  }

  /** Persist the snapshot file (source of truth). */
  private persist(snapshot: DatabaseTableSnapshot): void {
    const store = this.ctx.entityStore as
      | { write?: (type: string, slug: string, data: unknown) => unknown }
      | undefined;
    try {
      store?.write?.(DB_TABLE_ENTITY_TYPE, snapshot.slug, snapshot);
    } catch {
      /* file persistence is host-owned; ignore on absence */
    }
  }

  private removeFile(slug: string): void {
    const store = this.ctx.entityStore as
      | { remove?: (type: string, slug: string) => unknown }
      | undefined;
    try {
      store?.remove?.(DB_TABLE_ENTITY_TYPE, slug);
    } catch {
      /* ignore */
    }
  }

  /**
   * Defensive wrapper over the host-owned tag store. Method names are assumed from
   * the 1.0.0 contract and capability-checked, so a missing method is a no-op rather
   * than a crash. See `.claude4spec/patches/` for the assumption note.
   */
  private get tags() {
    const svc = this.ctx.tagsService as Record<string, any> | undefined;
    const type = DB_TABLE_ENTITY_TYPE;
    return {
      get(slug: string): string[] {
        try {
          const fn = svc?.getEntityTags ?? svc?.getTags ?? svc?.listForEntity;
          const res = fn ? fn.call(svc, type, slug) : undefined;
          return Array.isArray(res) ? res : [];
        } catch {
          return [];
        }
      },
      sync(slug: string, next?: string[]): void {
        if (next === undefined || !svc) return;
        try {
          const fn = svc.setEntityTags ?? svc.syncTags ?? svc.setTags;
          fn?.call(svc, type, slug, next);
        } catch {
          /* ignore */
        }
      },
      rename(oldSlug: string, newSlug: string): void {
        try {
          const fn = svc?.renameEntity ?? svc?.moveEntityTags;
          if (fn) {
            fn.call(svc, type, oldSlug, newSlug);
          } else if (svc) {
            const current = this.get(oldSlug);
            this.clear(oldSlug);
            this.sync(newSlug, current);
          }
        } catch {
          /* ignore */
        }
      },
      clear(slug: string): void {
        if (!svc) return;
        try {
          const fn = svc.clearEntityTags ?? svc.removeAllForEntity ?? svc.deleteEntityTags;
          fn ? fn.call(svc, type, slug) : svc.setEntityTags?.call(svc, type, slug, []);
        } catch {
          /* ignore */
        }
      },
    };
  }
}

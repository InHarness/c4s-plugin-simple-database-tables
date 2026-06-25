/**
 * L1 — SQLite migrations (per-plugin, idempotent). The host runs them on
 * `mountBackend` with its own `schema_version` counter for this plugin.
 *
 * Backs the `database-table` entity with the `database_table` table (deliberately
 * NOT `table`, a reserved SQL keyword). `columns` / `indexes` are stored as JSON
 * TEXT; soft-FKs are never enforced at the DB level (no real FK constraints).
 */

import type { SqlMigration } from '../../host';
import { DB_TABLE_SQLITE_TABLE } from '../../identity';

export const databaseTableMigrations: SqlMigration[] = [
  {
    version: 1,
    name: `create_${DB_TABLE_SQLITE_TABLE}`,
    // Idempotent SQL (must tolerate replay).
    up: `
      CREATE TABLE IF NOT EXISTS ${DB_TABLE_SQLITE_TABLE} (
        slug        TEXT NOT NULL PRIMARY KEY,
        name        TEXT NOT NULL,
        description TEXT,
        columns     TEXT NOT NULL DEFAULT '[]',  -- JSON: ColumnSpec[]
        indexes     TEXT NOT NULL DEFAULT '[]',  -- JSON: IndexSpec[]
        created_at  TEXT NOT NULL,
        updated_at  TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_${DB_TABLE_SQLITE_TABLE}_name
        ON ${DB_TABLE_SQLITE_TABLE} (name);
    `,
  },
];

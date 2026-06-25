/**
 * Shared DTOs for the `database-table` entity — used by the service (L2), the MCP
 * server (L3), the router (L4) and the serializer (L9). Dialect-agnostic; soft-FKs
 * are never enforced at the DB level.
 */

/** One entry of `columns[]`. */
export interface ColumnSpec {
  /** Column identifier (snake_case). */
  name: string;
  /** Dialect-agnostic type (text, integer, json, boolean, timestamp, ...). */
  type: string;
  /** Whether the column accepts NULL. Defaults false. */
  nullable?: boolean;
  /** Whether a UNIQUE constraint applies. */
  unique?: boolean;
  /** Whether the column is part of the primary key. */
  pk?: boolean;
  /** Soft foreign key. A dangling target produces a warning, never an error. */
  fk?: { table: string; column: string };
  /** Default value literal. */
  default?: string;
  /** Allowed values when the column is an enumeration. */
  enumValues?: string[];
  /** Prose description of the column. */
  description?: string;
}

/** One entry of `indexes[]`. */
export interface IndexSpec {
  /** Ordered list of column names. */
  columns: string[];
  unique?: boolean;
  /** Derived from columns if omitted. */
  name?: string;
}

/**
 * Full serialized shape of a database-table entity. This is both the source-of-truth
 * file format (`.claude4spec/entities/database-table/<slug>.json`) and the detail
 * payload exchanged over HTTP/MCP.
 */
export interface DatabaseTableSnapshot {
  /** Primary key / identity = slugify(name). */
  slug: string;
  name: string;
  description?: string;
  columns: ColumnSpec[];
  indexes: IndexSpec[];
  /** Tag slugs attached to the entity; synced on restore. */
  tags?: string[];
  created_at?: string;
  updated_at?: string;
}

/** Trimmed list shape returned by `GET /database-tables`. */
export interface DatabaseTableListItem {
  slug: string;
  name: string;
  description?: string;
  /** = columns.length */
  columnCount: number;
  /** any column with pk=true */
  hasPrimaryKey: boolean;
  tags?: string[];
}

/** A soft-FK that points at a table that does not (yet) exist. */
export interface FkWarning {
  column: string;
  table: string;
  message: string;
}

/** A soft-FK from another table that points at the slug being deleted. */
export interface DanglingFk {
  /** The table that holds the now-dangling reference. */
  fromTable: string;
  /** The column on `fromTable` whose `fk.table` pointed at the deleted slug. */
  column: string;
  /** The deleted slug the reference pointed at. */
  toTable: string;
}

/** Derive a stable index name when one is not provided. */
export function deriveIndexName(table: string, index: IndexSpec): string {
  if (index.name && index.name.trim()) return index.name;
  return `idx_${table}_${index.columns.join('_')}`;
}

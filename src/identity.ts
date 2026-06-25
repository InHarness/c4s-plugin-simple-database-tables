/**
 * Entity identity + `slugFrom` — shared by the backend (`plugin.ts`) and the
 * frontend (`frontend.tsx`). KEPT SEPARATE, with no backend/frontend imports, so
 * the frontend entry does not pull in Express/SQLite and the backend entry does
 * not pull in React.
 *
 * The single contributed entity is `database-table` (SQLite table `database_table`).
 * The slug is the primary key and is always `slugify(name)`, kebab-case.
 */

export const DB_TABLE_ENTITY_TYPE = 'database-table'; // kebab-case entity type
export const DB_TABLE_SQLITE_TABLE = 'database_table'; // snake_case SQLite table (NOT reserved `table`)
export const DB_TABLE_PATH_PREFIX = '/database-tables'; // WITHOUT "/api" (host prepends /api/projects/:id)
export const DB_TABLE_LABEL = 'Database Table';
export const DB_TABLE_LABEL_PLURAL = 'Database Tables';
export const DB_TABLE_DISPLAY_ORDER = 100; // sidebar order (lower = earlier)

/**
 * `slugFrom` — called ONLY on create (when no explicit slug), never on update.
 * The entity's identity derives from its `name` field: `slug = slugify(name)`.
 * Fallback chain: explicit slug → derived from `name` → random suffix.
 */
export function databaseTableSlugFrom(data: unknown): string {
  const d = (data ?? {}) as { slug?: string; name?: string };
  if (d.slug && d.slug.trim()) return slugify(d.slug);
  if (d.name && d.name.trim()) return slugify(d.name);
  return `${DB_TABLE_ENTITY_TYPE}-${randomSuffix()}`;
}

export function slugify(input: string): string {
  return input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

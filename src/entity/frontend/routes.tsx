/**
 * Phase 3 (M33) — the plugin's page routes, as a `RouteTreeFragment`.
 *
 * The host owns a SINGLE TanStack Router. A plugin contributes pages by exporting
 * a factory `({ rootRoute }) => Route[]`: it can't reference the host's `rootRoute`
 * at authoring time, but `createRoute` needs `getParentRoute: () => rootRoute`, so
 * the host passes its live root in when it mounts the fragment.
 *
 * `@tanstack/react-router` is a SHARED library peer (one instance via the host
 * import map) — externalized in vite.config.ts, never bundled — so these routes
 * and the host's router share the same route-tree machinery.
 *
 * Two routes: the list (`/database-tables`) and the read-only detail
 * (`/database-tables/$slug`). Detail-edit parity (rename/delete/history) is
 * deferred — the callbacks navigate but the panel itself is read-only for now.
 */

import * as React from 'react';
import { createRoute, useNavigate, useParams } from '@tanstack/react-router';
import type { RouteTreeFragment, AnyRoute, Tag } from '../../host';
import { EntityListHeader, TagFilterBar } from '../../host';
import { DB_TABLE_LABEL_PLURAL, DB_TABLE_PATH_PREFIX } from '../../identity';
import { DatabaseTableDetail } from './detail-panel';
import { DatabaseTableRow, synthTag } from './render-row';
import { useDatabaseTableList } from './hooks';
import type { DatabaseTableSnapshot } from '../dto';

/** A full-height pane matching the host's content area (uses host CSS tokens). */
const Pane: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <main style={{ flex: 1, minWidth: 0, height: '100%', background: 'var(--c-bg)', overflow: 'auto' }}>
    {children}
  </main>
);

function DatabaseTablesListRoute() {
  const navigate = useNavigate();
  const { data, isLoading } = useDatabaseTableList();

  // List-level state owned by the plugin's own route — `FrontendModule` has no
  // list-header/container slot, so the native sequence (header → search →
  // TagFilterBar → rows) lives here, never inside `renderRow`.
  const [search, setSearch] = React.useState('');
  const [selectedTags, setSelectedTags] = React.useState<string[]>([]);
  const [tagMode, setTagMode] = React.useState<'and' | 'or'>('or');

  // Tag universe + lookup, derived from the (unfiltered) list items' own slugs —
  // the plugin has no host-reachable tag catalog. Synthesized identically to the row
  // chips (see `synthTag`).
  const tagUniverse = React.useMemo<Tag[]>(() => {
    const slugs = new Set<string>();
    for (const item of data) for (const t of item.tags ?? []) slugs.add(t);
    return Array.from(slugs)
      .sort()
      .map(synthTag);
  }, [data]);

  const toggleTag = React.useCallback((slug: string) => {
    setSelectedTags((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug],
    );
  }, []);

  // Client-side filtering: search over name/description, tag match honoring AND/OR.
  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.filter((item) => {
      const matchesSearch =
        !q ||
        item.name.toLowerCase().includes(q) ||
        (item.description ?? '').toLowerCase().includes(q);
      if (!matchesSearch) return false;
      if (!selectedTags.length) return true;
      const itemTags = item.tags ?? [];
      return tagMode === 'and'
        ? selectedTags.every((t) => itemTags.includes(t))
        : selectedTags.some((t) => itemTags.includes(t));
    });
  }, [data, search, selectedTags, tagMode]);

  return (
    <Pane>
      <EntityListHeader
        title={DB_TABLE_LABEL_PLURAL}
        count={filtered.length}
        search={search}
        onSearchChange={setSearch}
      />
      {tagUniverse.length ? (
        <TagFilterBar
          tags={tagUniverse}
          tagFilter={selectedTags}
          onTagToggle={toggleTag}
          tagMode={tagMode}
          onToggleMode={() => setTagMode((m) => (m === 'and' ? 'or' : 'and'))}
          onClear={() => setSelectedTags([])}
        />
      ) : null}
      {isLoading ? (
        <div style={{ padding: 16, color: 'var(--c-muted)' }}>Loading…</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: 16, color: 'var(--c-muted)' }}>
          {data.length === 0 ? 'No database tables yet.' : 'No matching database tables.'}
        </div>
      ) : (
        <div role="list" style={{ padding: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {filtered.map((item) => (
            <DatabaseTableRow
              key={item.slug}
              // The list endpoint is trimmed (columnCount, not columns) — give the
              // row a length-only columns array so its count badge renders, and pass
              // the item's tag slugs through for the row's chips.
              entity={
                {
                  slug: item.slug,
                  name: item.name,
                  description: item.description,
                  columns: new Array<unknown>(item.columnCount),
                  indexes: [],
                  tags: item.tags ?? [],
                } as unknown as DatabaseTableSnapshot
              }
              onOpen={() =>
                navigate({ to: `${DB_TABLE_PATH_PREFIX}/$slug`, params: { slug: item.slug } })
              }
            />
          ))}
        </div>
      )}
    </Pane>
  );
}

function DatabaseTableDetailRoute() {
  const navigate = useNavigate();
  const { slug } = useParams({ from: `${DB_TABLE_PATH_PREFIX}/$slug` }) as { slug: string };
  return (
    <Pane>
      <DatabaseTableDetail
        slug={slug}
        onBack={() => navigate({ to: DB_TABLE_PATH_PREFIX })}
        onDeleted={() => navigate({ to: DB_TABLE_PATH_PREFIX })}
        onRenamed={(newSlug) =>
          navigate({ to: `${DB_TABLE_PATH_PREFIX}/$slug`, params: { slug: newSlug }, replace: true })
        }
      />
    </Pane>
  );
}

/**
 * The fragment factory. The host calls this once when mounting the module, then
 * adds the returned routes to its single router.
 */
export const databaseTableRoutes: RouteTreeFragment = ({ rootRoute }) => {
  const listRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: DB_TABLE_PATH_PREFIX,
    component: DatabaseTablesListRoute,
  });
  const detailRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: `${DB_TABLE_PATH_PREFIX}/$slug`,
    component: DatabaseTableDetailRoute,
  });
  return [listRoute, detailRoute] as AnyRoute[];
};

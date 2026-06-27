/**
 * Frontend data-resolution slots: `useGetBySlug` + `listByTags`. The host calls them
 * to feed the render components and the list views. They use the host's shared
 * `QueryClient` (one fetch per slug, shared cache).
 *
 * NOTE: the backend router is mounted under `/api/projects/:id/database-tables`. The
 * client reads the project id from the host's server-injected global
 * `window.__C4S_PROJECT__.id` (M31 — the same source the host's own `apiFetch` uses).
 *
 * Project-scoped fetch is MANDATORY (M33 / L5-ui): every data fetch MUST carry the
 * `/api/projects/<id>` prefix. The host auto-applies a basepath only to client
 * NAVIGATION — it does NOT prefix data fetches, so the plugin composes the URL itself.
 * A bare `/api/...` request resolves to 404 (a loud failure, never a silent
 * degradation), so we never emit one: when the global is absent the id falls back to
 * the literal `'default'`, keeping the prefix intact.
 */

import { useQuery } from '@tanstack/react-query';
import { DB_TABLE_ENTITY_TYPE } from '../../identity';
import type { DatabaseTableListItem, DatabaseTableSnapshot } from '../dto';

function apiBase(): string {
  const pid =
    (typeof window !== 'undefined'
      ? (window as unknown as { __C4S_PROJECT__?: { id?: string } }).__C4S_PROJECT__?.id
      : undefined) ?? 'default';
  return `/api/projects/${pid}/database-tables`;
}

export function useDatabaseTableBySlug(slug: string | null): {
  data: DatabaseTableSnapshot | null | undefined;
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: [DB_TABLE_ENTITY_TYPE, slug],
    queryFn: async () => {
      if (!slug) return null;
      const res = await fetch(`${apiBase()}/${encodeURIComponent(slug)}`);
      if (!res.ok) return null;
      return (await res.json()) as DatabaseTableSnapshot;
    },
    enabled: !!slug,
  });
  return { data: data as DatabaseTableSnapshot | null | undefined, isLoading };
}

/**
 * Phase 3 — the list-route data source. Returns the trimmed list items the
 * backend `GET /database-tables` serves (name + columnCount + description), via
 * the host's shared QueryClient.
 */
export function useDatabaseTableList(): {
  data: DatabaseTableListItem[];
  isLoading: boolean;
} {
  const { data, isLoading } = useQuery({
    queryKey: [DB_TABLE_ENTITY_TYPE, '__list__'],
    queryFn: async () => {
      const res = await fetch(apiBase());
      if (!res.ok) return [] as DatabaseTableListItem[];
      const body = (await res.json()) as
        | DatabaseTableListItem[]
        | { items?: DatabaseTableListItem[] };
      return Array.isArray(body) ? body : body.items ?? [];
    },
  });
  return { data: (data as DatabaseTableListItem[]) ?? [], isLoading };
}

export async function listDatabaseTableByTags(args: {
  tags: string[];
  filter: 'and' | 'or';
}): Promise<Array<{ slug: string }>> {
  const params = new URLSearchParams();
  if (args.tags.length) {
    params.set('tags', args.tags.join(','));
    params.set('tagFilter', args.filter);
  }
  const res = await fetch(`${apiBase()}?${params.toString()}`);
  if (!res.ok) return [];
  const body = (await res.json()) as DatabaseTableListItem[] | { items?: DatabaseTableListItem[] };
  // The list endpoint returns a bare array (brief); tolerate a legacy { items } wrapper.
  const items = Array.isArray(body) ? body : body.items ?? [];
  return items.map((i) => ({ slug: i.slug }));
}

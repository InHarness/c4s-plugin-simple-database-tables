/**
 * Frontend data-resolution slots: `useGetBySlug` + `listByTags`. The host calls them
 * to feed the render components and the list views. They use the host's shared
 * `QueryClient` (one fetch per slug, shared cache).
 *
 * NOTE: the backend router is mounted under `/api/projects/:id/database-tables`. The
 * client-side project id is host-specific; we read it from a host-provided global
 * (`window.__c4s_projectId`) and fall back to a relative path. See the
 * `frontend-fetch-prefix` patch in `.claude4spec/patches/`.
 */

import { useQuery } from '@tanstack/react-query';
import { DB_TABLE_ENTITY_TYPE } from '../../identity';
import type { DatabaseTableListItem, DatabaseTableSnapshot } from '../dto';

function apiBase(): string {
  const pid =
    typeof window !== 'undefined'
      ? (window as unknown as { __c4s_projectId?: string }).__c4s_projectId
      : undefined;
  return pid ? `/api/projects/${pid}/database-tables` : `/api/database-tables`;
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

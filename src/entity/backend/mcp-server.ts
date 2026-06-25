/**
 * L3 — the `database-table` MCP server. Mounted by the host as `database-table-tools`
 * via a FACTORY (`() => create...`), so each agent turn gets a fresh instance (safe
 * under hot-reload). Five CRUD tools delegating to the L2 service. Contract from
 * `@inharness-ai/agent-adapters`: `createMcpServer`, `mcpTool` (schema = a zod
 * object), handler returns `{ content: [{ type:'text', text }], isError? }`.
 */

import { createMcpServer, mcpTool, type McpServerInstance } from '@inharness-ai/agent-adapters';
import { z } from 'zod';
import type { MountContext } from '../../host';
import { DB_TABLE_ENTITY_TYPE } from '../../identity';
import type { DatabaseTableService } from './services';

// Zod shapes mirroring the DTOs (loose, dialect-agnostic).
const columnSpec = z.object({
  name: z.string(),
  type: z.string(),
  nullable: z.boolean().optional(),
  unique: z.boolean().optional(),
  pk: z.boolean().optional(),
  fk: z.object({ table: z.string(), column: z.string() }).optional(),
  default: z.string().optional(),
  enumValues: z.array(z.string()).optional(),
  description: z.string().optional(),
});
const indexSpec = z.object({
  columns: z.array(z.string()),
  unique: z.boolean().optional(),
  name: z.string().optional(),
});

export function createDatabaseTableToolsServer(
  service: DatabaseTableService,
  ctx: MountContext,
): McpServerInstance {
  const ok = (payload: unknown) => ({
    content: [{ type: 'text' as const, text: JSON.stringify(payload) }],
  });
  const fail = (err: unknown) => ({
    content: [
      {
        type: 'text' as const,
        text: JSON.stringify({ error: err instanceof Error ? err.message : String(err) }),
      },
    ],
    isError: true,
  });
  const broadcast = (slug: string) =>
    ctx.ws.broadcast({ kind: 'entity:changed', entityType: DB_TABLE_ENTITY_TYPE, slug });

  const create_database_table = mcpTool(
    'create_database_table',
    'Create a database-table spec. The slug is derived as slugify(name). Soft-FK targets that do not exist yet return warnings (not errors) — tables can be created in any order.',
    {
      name: z.string().describe('Human display name, snake_case table identifier (e.g. order_items)'),
      description: z.string().optional(),
      columns: z.array(columnSpec).optional(),
      indexes: z.array(indexSpec).optional(),
    },
    async (args) => {
      try {
        const { snapshot, warnings } = service.create(
          {
            name: args.name as string,
            description: args.description as string | undefined,
            columns: args.columns as never,
            indexes: args.indexes as never,
          },
          'agent',
        );
        broadcast(snapshot.slug);
        return ok({ ...snapshot, warnings });
      } catch (err) {
        return fail(err);
      }
    },
  );

  const get_database_table = mcpTool(
    'get_database_table',
    'Get a database-table by slug.',
    { slug: z.string() },
    async (args) => {
      const snapshot = service.getBySlug(String(args.slug));
      if (!snapshot) return fail(new Error(`database-table '${String(args.slug)}' not found`));
      return ok(snapshot);
    },
  );

  const list_database_table = mcpTool(
    'list_database_table',
    'List database-tables (trimmed items with columnCount and hasPrimaryKey). Optional filters: tags / tagFilter / search.',
    {
      tags: z.array(z.string()).optional(),
      tagFilter: z.enum(['and', 'or']).optional(),
      search: z.string().optional(),
      limit: z.number().optional(),
      offset: z.number().optional(),
    },
    async (args) => {
      try {
        const items = service.list({
          tags: args.tags as string[] | undefined,
          tagFilter: args.tagFilter as 'and' | 'or' | undefined,
          search: args.search as string | undefined,
          limit: args.limit as number | undefined,
          offset: args.offset as number | undefined,
        });
        return ok({ items, total: items.length });
      } catch (err) {
        return fail(err);
      }
    },
  );

  const update_database_table = mcpTool(
    'update_database_table',
    'Update a database-table (partial). Changing name/columns/indexes never moves the slug; rename ONLY via newSlug (propagates to fk.table refs and M19 references).',
    {
      slug: z.string(),
      data: z
        .object({
          name: z.string().optional(),
          description: z.string().optional(),
          columns: z.array(columnSpec).optional(),
          indexes: z.array(indexSpec).optional(),
        })
        .describe('Fields to change'),
      newSlug: z.string().optional().describe('Explicit slug rename'),
    },
    async (args) => {
      try {
        const data = (args.data ?? {}) as Record<string, unknown>;
        const { snapshot, previousSlug, warnings } = service.update(
          String(args.slug),
          {
            name: data.name as string | undefined,
            description: data.description as string | undefined,
            columns: data.columns as never,
            indexes: data.indexes as never,
            newSlug: args.newSlug as string | undefined,
          },
          'agent',
        );
        if (snapshot.slug !== previousSlug) broadcast(previousSlug);
        broadcast(snapshot.slug);
        return ok({ ...snapshot, warnings });
      } catch (err) {
        return fail(err);
      }
    },
  );

  const delete_database_table = mcpTool(
    'delete_database_table',
    'Delete a database-table by slug. CASCADEs its entity_tag rows; soft-FKs are NOT cascaded — references that pointed at it are returned in danglingFks.',
    { slug: z.string() },
    async (args) => {
      try {
        const slug = String(args.slug);
        const result = service.remove(slug, 'agent');
        broadcast(slug);
        return ok(result);
      } catch (err) {
        return fail(err);
      }
    },
  );

  return createMcpServer({
    name: `${DB_TABLE_ENTITY_TYPE}-tools`,
    tools: [
      create_database_table,
      get_database_table,
      list_database_table,
      update_database_table,
      delete_database_table,
    ],
  });
}

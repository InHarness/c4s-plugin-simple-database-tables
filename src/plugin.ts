/**
 * Composition of the `database-table` entity as an `EntityContribution` — host 1.0.0
 * contract.
 *
 * The backend is a single imperative `backend.mount(ctx)` that builds the service,
 * mounts the router (`ctx.app.use`), registers the MCP server as a FACTORY
 * (`ctx.registerMcpServer`) and exposes the service to cross-cutting consumers
 * (`ctx.registerEntityService`). Render components live in `src/frontend.tsx` so
 * React is not pulled into the backend entry.
 */

import type { EntityContribution, MountContext } from './host';
import {
  DB_TABLE_ENTITY_TYPE,
  DB_TABLE_SQLITE_TABLE,
  DB_TABLE_PATH_PREFIX,
  DB_TABLE_LABEL,
  DB_TABLE_LABEL_PLURAL,
  DB_TABLE_DISPLAY_ORDER,
  databaseTableSlugFrom,
} from './identity';
import { databaseTableMigrations } from './entity/backend/migrations';
import { databaseTableSerializer } from './entity/serializer';
import { databaseTableSystemPrompt } from './entity/system-prompt';
import { DatabaseTableService } from './entity/backend/services';
import { createDatabaseTableRouter } from './entity/backend/routes';
import { createDatabaseTableToolsServer } from './entity/backend/mcp-server';

export const DatabaseTableEntity: EntityContribution = {
  // ─── Identity (EntityModuleManifest) ───
  type: DB_TABLE_ENTITY_TYPE,
  table: DB_TABLE_SQLITE_TABLE,
  label: DB_TABLE_LABEL,
  labelPlural: DB_TABLE_LABEL_PLURAL,
  displayOrder: DB_TABLE_DISPLAY_ORDER,
  pathPrefix: DB_TABLE_PATH_PREFIX,
  slugFrom: databaseTableSlugFrom,

  // ─── Cross-cutting ───
  serializer: databaseTableSerializer, // L9
  systemPrompt: databaseTableSystemPrompt, // M05

  // ─── Backend (L1–L4) ───
  backend: {
    migrations: databaseTableMigrations, // L1
    mount(ctx: MountContext) {
      // L2 — build the service from host dependencies (db + cross-cutting in ctx).
      const service = new DatabaseTableService(ctx.db, ctx);
      // L4 — mount the router under pathPrefix (the host prepends /api/projects/:id).
      ctx.app.use(DB_TABLE_PATH_PREFIX, createDatabaseTableRouter(service, ctx));
      // L3 — register the MCP server as a FACTORY (fresh instance per agent turn).
      ctx.registerMcpServer(`${DB_TABLE_ENTITY_TYPE}-tools`, () =>
        createDatabaseTableToolsServer(service, ctx),
      );
      // M17 — expose the service to cross-cutting consumers (release restore).
      ctx.registerEntityService(DB_TABLE_ENTITY_TYPE, service);
    },
  },
};

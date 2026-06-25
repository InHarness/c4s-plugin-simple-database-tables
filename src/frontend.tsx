/**
 * Frontend ENTRY — loaded by the host as native ESM (via the `window.__c4s_shared`
 * import-map shim). Evaluating this module REGISTERS the `database-table` frontend
 * module as a side effect (`registerFrontendModule`).
 *
 * KEY (1.0.0 contract): render components receive the already-resolved entity in props
 * (`{ slug, entity, onOpen }`); they do NOT self-fetch. The module provides
 * `useGetBySlug` and `listByTags` for the host to resolve data (the detail panel uses
 * `useGetBySlug` to self-fetch).
 */

import * as React from 'react';
import { registerFrontendModule } from './host';
import type { FrontendModule } from './host';
import {
  DB_TABLE_ENTITY_TYPE,
  DB_TABLE_SQLITE_TABLE,
  DB_TABLE_PATH_PREFIX,
  DB_TABLE_LABEL,
  DB_TABLE_LABEL_PLURAL,
  DB_TABLE_DISPLAY_ORDER,
  databaseTableSlugFrom,
} from './identity';
import { DatabaseTableChip } from './entity/frontend/render-chip';
import { DatabaseTableCard } from './entity/frontend/render-card';
import { DatabaseTableRow } from './entity/frontend/render-row';
import { DatabaseTableDetail } from './entity/frontend/detail-panel';
import { useDatabaseTableBySlug, listDatabaseTableByTags } from './entity/frontend/hooks';
import { databaseTableSlashCommand } from './entity/frontend/slash-command';
import { databaseTableRoutes } from './entity/frontend/routes';

/** Sidebar icon — a small grid/table glyph (no lucide-react dependency). */
const DatabaseTableIcon: React.FC<{ className?: string; size?: number | string }> = ({
  className,
  size = 16,
}) => (
  <svg
    className={className}
    width={size}
    height={size}
    viewBox="0 0 16 16"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.5}
    aria-hidden="true"
  >
    <rect x="2.5" y="2.5" width="11" height="11" rx="2" />
    <path d="M2.5 6.5h11M6.5 6.5v7" />
  </svg>
);

export const DatabaseTableFrontendModule: FrontendModule = {
  // ─── Identity (must match the backend) ───
  type: DB_TABLE_ENTITY_TYPE,
  table: DB_TABLE_SQLITE_TABLE,
  label: DB_TABLE_LABEL,
  labelPlural: DB_TABLE_LABEL_PLURAL,
  displayOrder: DB_TABLE_DISPLAY_ORDER,
  pathPrefix: DB_TABLE_PATH_PREFIX,
  slugFrom: databaseTableSlugFrom,

  // ─── L8 render slots (entity injected by the host) ───
  renderChip: DatabaseTableChip,
  renderCard: DatabaseTableCard,
  renderRow: DatabaseTableRow,
  detailPanel: DatabaseTableDetail,

  // ─── Data resolution (the host calls these slots) ───
  useGetBySlug: useDatabaseTableBySlug,
  listByTags: listDatabaseTableByTags,

  // ─── L5 — sidebar tab ───
  sidebarTab: {
    icon: DatabaseTableIcon,
    label: DB_TABLE_LABEL_PLURAL,
    order: DB_TABLE_DISPLAY_ORDER,
  },

  // ─── L8 — editor extensions (slash command). The host pins them onto its Tiptap. ───
  editorExtensions: [databaseTableSlashCommand],

  // ─── Phase 3 — page routes (list + detail), mounted into the host's router. ───
  routes: databaseTableRoutes,
};

// Register as a side effect when the frontend module is evaluated.
registerFrontendModule(DatabaseTableFrontendModule);

export default DatabaseTableFrontendModule;

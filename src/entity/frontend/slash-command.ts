/**
 * L8 — editor extension registration (slash command `/database-table`). It goes into
 * `FrontendModule.editorExtensions`; the host pins it onto its single Tiptap instance.
 * The command id is slug-aligned (`database-table`, NOT `dbtable`). DECLARATIVE variant
 * — the host opens a popover by `pluginPopoverKind`.
 */

import type { EditorExtensionRegistration } from '../../host';

export const databaseTableSlashCommand: EditorExtensionRegistration = {
  name: 'database-table-slash',
  slashCommand: {
    id: 'database-table',
    label: '/database-table',
    description: 'Insert / create a database-table reference',
    hint: 'slug',
    pluginPopoverKind: 'database-table-create',
  },
};

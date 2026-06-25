/**
 * M05 — `SystemPromptContribution`. REQUIRED: without it the agent behaves as if the
 * entity type did not exist (no `database-table-tools` in the prompt, no entity count).
 *
 * Teaches the agent the slug rule, soft-FK semantics, and the `database_table`
 * (not reserved `table`) naming.
 */

import type { SystemPromptContribution } from '../host';
import { DB_TABLE_SQLITE_TABLE } from '../identity';

export const databaseTableSystemPrompt: SystemPromptContribution = {
  roleNoun: 'Database Tables',
  countStat: {
    placeholder: 'databaseTableCount',
    sqlQuery: `SELECT COUNT(*) AS count FROM ${DB_TABLE_SQLITE_TABLE}`,
    label: 'database-table',
  },
  mcpToolsLine:
    'database-table-tools: create_database_table, get_database_table, list_database_table, update_database_table, delete_database_table',
  narrativeBlock: [
    'Database Tables describe a project\'s data model. Each table is identified by a',
    'kebab-case slug = slugify(name) (its primary key) and is backed by the SQLite',
    'table `database_table` — never the reserved keyword `table`. A table owns an',
    'ordered list of columns (name, type, nullable, unique, pk, default, enumValues)',
    'and indexes (ordered columns, optional unique).',
    'Foreign keys are SOFT: a column may declare fk: { table, column }, but a target',
    'that does not exist yet produces a WARNING, never an error — so tables can be',
    'created in any order. Renaming a table happens ONLY via an explicit newSlug,',
    'which repoints every fk.table reference and all page references to the new slug.',
    'Deleting a table never cascades soft-FKs; references that pointed at it are',
    'reported as dangling for you to fix.',
  ].join(' '),
};

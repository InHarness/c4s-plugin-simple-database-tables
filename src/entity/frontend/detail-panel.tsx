/**
 * L8/L5 — entity detail panel (sidebar). Props (1.0.0 contract):
 * `{ slug, onDeleted, onRenamed, onBack }`. Unlike chip/card/row you only get `slug`
 * + navigation callbacks — fetch the data with the plugin's own `useDatabaseTableBySlug`
 * hook (NOT the M20 embed hook `useEntity`).
 *
 * The view is framed with the Host UI Kit (`stable` core, `@c4s/plugin-runtime/ui`):
 *   - `DetailPanelShell` — frame + breadcrumb (NO `title` prop; the header is the last
 *     breadcrumb segment).
 *   - `FieldGrid` / `FieldRow` — `FieldRow` takes its value as `children`, not `value`.
 * The kit is pure-presentational; the plugin still owns the fetch.
 */

import * as React from 'react';
import type { EntityDetailProps } from '../../host';
import { DetailPanelShell, FieldGrid, FieldRow } from '../../host';
import { DB_TABLE_ENTITY_TYPE, DB_TABLE_LABEL_PLURAL } from '../../identity';
import { useDatabaseTableBySlug } from './hooks';
import { deriveIndexName, type ColumnSpec, type IndexSpec } from '../dto';

function columnLine(c: ColumnSpec): string {
  const flags = [
    c.pk ? 'PK' : null,
    c.unique ? 'UNIQUE' : null,
    c.nullable ? 'NULL' : 'NOT NULL',
    c.fk ? `FK→${c.fk.table}.${c.fk.column}` : null,
  ].filter(Boolean);
  return `${c.name} : ${c.type}${flags.length ? ` (${flags.join(', ')})` : ''}`;
}

function indexLine(i: IndexSpec): string {
  return `${deriveIndexName(DB_TABLE_ENTITY_TYPE, i)}${i.unique ? ' UNIQUE' : ''} (${i.columns.join(', ')})`;
}

export const DatabaseTableDetail: React.FC<EntityDetailProps> = ({
  slug,
  onDeleted,
  onRenamed,
  onBack,
}) => {
  const { data, isLoading } = useDatabaseTableBySlug(slug);

  if (isLoading) return <div>Loading…</div>;
  if (!data) return <div role="alert">Not found: {slug}</div>;

  const columns = data.columns ?? [];
  const indexes = data.indexes ?? [];

  return (
    <DetailPanelShell
      breadcrumb={[{ label: DB_TABLE_LABEL_PLURAL, onClick: onBack }, { label: data.name ?? slug }]}
    >
      <FieldGrid>
        <FieldRow label="Slug">{slug}</FieldRow>
        <FieldRow label="Name">{data.name}</FieldRow>
        {data.description ? <FieldRow label="Description">{data.description}</FieldRow> : null}
        <FieldRow label="Columns" align="start">
          {columns.length ? (
            <ul>
              {columns.map((c) => (
                <li key={c.name}>{columnLine(c)}</li>
              ))}
            </ul>
          ) : (
            <em>none</em>
          )}
        </FieldRow>
        <FieldRow label="Indexes" align="start">
          {indexes.length ? (
            <ul>
              {indexes.map((i) => (
                <li key={deriveIndexName(DB_TABLE_ENTITY_TYPE, i)}>{indexLine(i)}</li>
              ))}
            </ul>
          ) : (
            <em>none</em>
          )}
        </FieldRow>
      </FieldGrid>
      {/* Navigation callbacks (onDeleted/onRenamed) are wired by the host's edit
          actions; referenced here so the contract stays explicit. */}
      <span hidden>{String(Boolean(onDeleted) && Boolean(onRenamed))}</span>
    </DetailPanelShell>
  );
};

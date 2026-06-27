/**
 * L8 — card (single element). PURE REACT + entity injected by the host.
 * Same bans as the chip (no useEditor/editor.commands/PM state).
 */

import * as React from 'react';
import { editorBridge } from '../../host';
import type { EntityCardProps } from '../../host';
import { DB_TABLE_ENTITY_TYPE } from '../../identity';
import type { DatabaseTableSnapshot } from '../dto';

// Style the card with the host token-bridge `--c-*` CSS vars (the same
// c4s-paper-terra tokens the frontend.routes list route consumes) so single-element
// embeds render framed in the host shell rather than naked. No hard-coded colors —
// the tokens keep the host's light/dark theme modes working.
const cardStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  textAlign: 'left',
  padding: '8px 12px',
  borderRadius: 6,
  background: 'var(--c-bg)',
  color: 'var(--c-fg)',
  border: '1px solid var(--c-border)',
  cursor: 'pointer',
};
const mutedStyle: React.CSSProperties = { color: 'var(--c-muted)' };

export const DatabaseTableCard: React.FC<EntityCardProps> = ({ slug, entity, onOpen }) => {
  const data = entity as DatabaseTableSnapshot | null;
  const open = () => (onOpen ? onOpen() : editorBridge.openEntity(DB_TABLE_ENTITY_TYPE, slug));

  if (!data) {
    return (
      <div role="alert" style={cardStyle}>
        ⚠ broken: database-table "{slug}"
      </div>
    );
  }

  const columnCount = data.columns?.length ?? 0;
  const hasPk = (data.columns ?? []).some((c) => c.pk === true);

  return (
    <button type="button" onClick={open} style={cardStyle}>
      <strong>⌗ {data.name ?? slug}</strong>
      <div style={mutedStyle}>
        {columnCount} column{columnCount === 1 ? '' : 's'}
        {hasPk ? ' · PK' : ''}
      </div>
      {data.description ? <p style={{ ...mutedStyle, margin: 0 }}>{data.description}</p> : null}
    </button>
  );
};

/**
 * L8 — card (single element). PURE REACT + entity injected by the host.
 * Same bans as the chip (no useEditor/editor.commands/PM state).
 */

import * as React from 'react';
import { editorBridge } from '../../host';
import type { EntityCardProps } from '../../host';
import { DB_TABLE_ENTITY_TYPE } from '../../identity';
import type { DatabaseTableSnapshot } from '../dto';

export const DatabaseTableCard: React.FC<EntityCardProps> = ({ slug, entity, onOpen }) => {
  const data = entity as DatabaseTableSnapshot | null;
  const open = () => (onOpen ? onOpen() : editorBridge.openEntity(DB_TABLE_ENTITY_TYPE, slug));

  if (!data) {
    return <div role="alert">⚠ broken: database-table "{slug}"</div>;
  }

  const columnCount = data.columns?.length ?? 0;
  const hasPk = (data.columns ?? []).some((c) => c.pk === true);

  return (
    <button type="button" onClick={open}>
      <strong>⌗ {data.name ?? slug}</strong>
      <div>
        {columnCount} column{columnCount === 1 ? '' : 's'}
        {hasPk ? ' · PK' : ''}
      </div>
      {data.description ? <p>{data.description}</p> : null}
    </button>
  );
};

/**
 * L8 — list row (element/tagged list). PURE REACT.
 * Props (1.0.0 contract): `{ entity, active, onOpen }` — entity is always present
 * (the host injects the resolved entity; chip/card/row do NOT self-fetch).
 *
 * SINGLE-ROW renderer: the host calls it once per entity inside its own list views.
 * The list-level header/search/count (`EntityListHeader`) is owned by the host
 * sidebar list pages — `FrontendModule` exposes no list-container hook.
 *
 * A row shows: name + a column-count badge + the description.
 */

import * as React from 'react';
import type { EntityRowProps } from '../../host';
import type { DatabaseTableSnapshot } from '../dto';

export const DatabaseTableRow: React.FC<EntityRowProps> = ({ entity, active, onOpen }) => {
  const data = entity as DatabaseTableSnapshot;
  const columnCount = data.columns?.length ?? 0;

  return (
    <button type="button" onClick={onOpen} aria-current={active ? 'true' : undefined}>
      <span>⌗ {data.name ?? data.slug}</span>
      <span aria-label={`${columnCount} columns`}>
        {columnCount} col{columnCount === 1 ? '' : 's'}
      </span>
      {data.description ? <span>{data.description}</span> : null}
    </button>
  );
};

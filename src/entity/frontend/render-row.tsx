/**
 * L8 — list row (element/tagged list). PURE REACT.
 * Props (1.0.0 contract): `{ entity, active, onOpen }` — entity is always present
 * (the host injects the resolved entity; chip/card/row do NOT self-fetch).
 *
 * SINGLE-ROW renderer: the host calls it once per entity inside its own list views.
 * The list-level header/search/count (`EntityListHeader`) is owned by the host
 * sidebar list pages — `FrontendModule` exposes no list-container hook.
 *
 * Rendered through the Host UI Kit `EntityListRow` (L12 / M34, EXPERIMENTAL-tier)
 * instead of hand-written markup: name + description in `children`, the table glyph
 * as `leading`, the column count as `trailing`, and the entity's tag slugs as chips.
 * `EntityListRow` needs a `tagLookup` Map to resolve chip slugs → name/color; the row
 * contract gives no tag catalog, so we synthesize one from the entity's own slugs
 * (see `synthTag`). The kit handles the framing/token-bridge styling.
 */

import * as React from 'react';
import type { EntityRowProps, Tag } from '../../host';
import { EntityListRow } from '../../host';
import type { DatabaseTableSnapshot } from '../dto';

/**
 * Build a placeholder `Tag` from a bare slug. The plugin has no host-reachable tag
 * catalog (no exported `useTags`), so chip name = slug and color is unset. Shared
 * with the list route so rows and the `TagFilterBar` synthesize identical tags.
 */
export function synthTag(slug: string): Tag {
  return {
    slug,
    name: slug,
    color: null,
    description: null,
    counts: {},
    createdAt: '',
    updatedAt: '',
  };
}

const mutedStyle: React.CSSProperties = { color: 'var(--c-muted)' };

export const DatabaseTableRow: React.FC<EntityRowProps> = ({ entity, onOpen }) => {
  const data = entity as DatabaseTableSnapshot;
  const columnCount = data.columns?.length ?? 0;
  const tags = data.tags ?? [];
  const tagLookup = React.useMemo(
    () => new Map<string, Tag>(tags.map((slug) => [slug, synthTag(slug)])),
    [tags],
  );

  return (
    <EntityListRow
      leading={<span aria-hidden="true">⌗</span>}
      onClick={onOpen ?? (() => {})}
      tags={tags}
      tagLookup={tagLookup}
      trailing={
        <span aria-label={`${columnCount} columns`} style={mutedStyle}>
          {columnCount} col{columnCount === 1 ? '' : 's'}
        </span>
      }
    >
      <span>{data.name ?? data.slug}</span>
      {data.description ? <span style={mutedStyle}> — {data.description}</span> : null}
    </EntityListRow>
  );
};

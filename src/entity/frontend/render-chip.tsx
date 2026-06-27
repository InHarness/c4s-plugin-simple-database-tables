/**
 * L8 — chip (inline). PURE REACT + entity injected by the host.
 *
 * Renders in TWO pipelines: Tiptap (the editor) AND react-markdown (chat). Hence the
 * BANS: no `useEditor()`/`useCurrentEditor()`, no `editor.commands.*`, no dependency
 * on ProseMirror (`NodeViewProps`/decorations). Click calls only
 * `editorBridge.openEntity(type, slug)`.
 *
 * Props (1.0.0 contract): `{ slug, entity, onOpen }` — the host PROVIDES the resolved
 * entity; `entity === null` ⇒ broken chip (NOT self-fetch).
 */

import * as React from 'react';
import { editorBridge } from '../../host';
import type { EntityChipProps } from '../../host';
import { DB_TABLE_ENTITY_TYPE } from '../../identity';
import type { DatabaseTableSnapshot } from '../dto';

// Style the inline chip with the host token-bridge `--c-*` CSS vars (the same
// c4s-paper-terra tokens the frontend.routes list route consumes) so the chip is
// framed in the host shell rather than naked. No hard-coded colors — the tokens keep
// the host's light/dark theme modes working.
const chipStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 4,
  padding: '1px 6px',
  borderRadius: 4,
  background: 'var(--c-bg)',
  color: 'var(--c-fg)',
  border: '1px solid var(--c-border)',
  cursor: 'pointer',
};

export const DatabaseTableChip: React.FC<EntityChipProps> = ({ slug, entity, onOpen }) => {
  const data = entity as DatabaseTableSnapshot | null;
  const open = () => (onOpen ? onOpen() : editorBridge.openEntity(DB_TABLE_ENTITY_TYPE, slug));

  if (!data) {
    return (
      <button
        type="button"
        onClick={open}
        title={`broken reference: database-table '${slug}'`}
        style={chipStyle}
      >
        ⚠ {slug}
      </button>
    );
  }

  return (
    <button type="button" onClick={open} title={data.description} style={chipStyle}>
      ⌗ {data.name ?? slug}
    </button>
  );
};

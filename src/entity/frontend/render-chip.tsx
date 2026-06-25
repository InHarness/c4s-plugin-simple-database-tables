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

export const DatabaseTableChip: React.FC<EntityChipProps> = ({ slug, entity, onOpen }) => {
  const data = entity as DatabaseTableSnapshot | null;
  const open = () => (onOpen ? onOpen() : editorBridge.openEntity(DB_TABLE_ENTITY_TYPE, slug));

  if (!data) {
    return (
      <button type="button" onClick={open} title={`broken reference: database-table '${slug}'`}>
        ⚠ {slug}
      </button>
    );
  }

  return (
    <button type="button" onClick={open} title={data.description}>
      ⌗ {data.name ?? slug}
    </button>
  );
};

/**
 * OFFLINE / OLDER-HOST FALLBACK for the Host API types (NOT active by default).
 *
 * The host now PUBLISHES its types: `@inharness-ai/claude4spec/plugin-runtime`
 * (+ `/ui`), referenced from `src/_host-types.d.ts`. That is the primary channel
 * and types both the `@c4s/plugin-runtime` value specifier and all type names.
 *
 * Use THIS file only when the published types are unavailable — an offline build
 * with no access to the `@inharness-ai/claude4spec` package, or a plugin pinned
 * to an older host that predates published types. To enable it, add this path to
 * tsconfig `include` (and drop the `_host-types.d.ts` reference so the two
 * `declare module '@c4s/plugin-runtime'` blocks don't collide).
 *
 * It mirrors the host 1.0.0 contract by hand, so it can drift — prefer the
 * published types whenever you can install them.
 */

declare module '@c4s/plugin-runtime' {
  import type { ComponentType } from 'react';

  /** The Host API version this build advertises (e.g. "1.0.0"). */
  export const HOST_API_VERSION: string;

  export interface PluginEngines {
    node?: string;
    [key: string]: string | undefined;
  }

  // ── Entity identity (shared) ──
  export interface EntityModuleManifest {
    type: string;
    table: string;
    label: string;
    labelPlural: string;
    displayOrder: number;
    slugFrom: (data: unknown) => string;
    pathPrefix: string;
  }

  // ── M05 ──
  export interface SystemPromptContribution {
    roleNoun: string;
    countStat: { placeholder: string; sqlQuery: string; label: string };
    mcpToolsLine: string;
    narrativeBlock?: string;
  }

  // ── L1 ──
  export interface SqlMigration {
    version: number;
    name: string;
    /** Idempotent SQL — must tolerate replay. */
    up: string;
  }

  // ── Backend mount ──
  // Host-provided dependencies are loosely typed (`any`) — this is an ambient
  // fallback, while the real types (Express Router, better-sqlite3 Database,
  // *Service) live deep in the host. This lets stub bodies call host methods
  // without casts.
  export interface MountContext {
    app: any;
    db: any;
    host: any;
    cwd: string;
    ws: { broadcast(msg: unknown): void };
    tagsService: any;
    versionService: any;
    referencesService: any;
    entityStore: any;
    registerMcpServer(name: string, factory: () => unknown): void;
    registerEntityService(type: string, service: unknown): void;
  }
  export type PluginMountFn = (ctx: MountContext) => void;

  // ── L9 serializer ──
  export interface SerializeContext {
    reader: unknown;
    depth: number;
    maxDepth: number;
  }
  export interface RestoreContext {
    reader: unknown;
    writer: unknown;
    releaseId: number | null;
    actor: 'user' | 'agent';
  }
  export interface RestoreResult<T = unknown> {
    op: 'created' | 'updated' | 'deleted' | 'noop';
    entity: T | null;
    warnings?: string[];
  }
  export interface EntityDiff {
    type: string;
    slug: string;
    op: 'created' | 'deleted' | 'modified' | 'noop';
    changes?: Record<string, unknown>;
  }
  export type SnapshotData = unknown;
  export interface EntitySerializer<T = unknown> {
    type: string;
    version: string;
    inlineMention?: (entity: T, ctx: SerializeContext) => unknown;
    singleElement?: (entity: T, ctx: SerializeContext) => unknown;
    elementListItem?: (entity: T, ctx: SerializeContext) => unknown;
    taggedListItem?: (entity: T, ctx: SerializeContext) => unknown;
    detail?: (entity: T, ctx: SerializeContext) => unknown;
    snapshot?: (entity: T, ctx: SerializeContext) => SnapshotData;
    restore?: (data: SnapshotData, ctx: RestoreContext) => RestoreResult;
    diff?: (a: SnapshotData, b: SnapshotData, slug: string) => EntityDiff;
  }

  // ── Capability: entity (authoring shape) ──
  export interface EntityContribution extends EntityModuleManifest {
    serializer: unknown;
    systemPrompt: SystemPromptContribution;
    backend?: {
      migrations?: SqlMigration[];
      mount?: PluginMountFn;
      routes?: unknown;
    };
    frontend?: unknown;
  }

  // ── Capability: settings (M26) ──
  export interface PluginSettingField {
    key: string;
    label: string;
    control: 'toggle' | 'text' | 'select' | 'multiselect';
    kind: 'hot-reload' | 'executive';
    default: unknown;
    options?: { value: string; label: string }[];
    help?: string;
  }
  export type PluginSettingsModule = PluginSettingField[];

  // ── Capability: commands (declarative slash) ──
  export interface PluginCommandContribution {
    name: string;
    trigger: string;
    label: string;
    popoverKind: string;
    availableIn?: string[];
  }

  // ── Capability: writing styles (M15) ──
  export interface WritingStyleContribution {
    slug: string;
    title: string;
    description: string;
    version: number;
    language: 'en' | 'pl';
    content: string;
    files?: Record<string, string>;
  }

  // ── Envelope ──
  export interface PluginManifest {
    name: string;
    version: string;
    hostApiVersion: string;
    engines?: PluginEngines;
    /** REQUIRED (1.0.0 baseline): idempotent, must not throw. */
    onUnregister(): void;
    contributes: {
      entities?: EntityContribution[];
      writingStyles?: WritingStyleContribution[];
      settings?: PluginSettingsModule;
      commands?: PluginCommandContribution[];
    };
  }

  // ── Frontend (L5/L8) ──
  export interface EntityChipProps<T = unknown> {
    slug: string;
    /** The host injects the resolved entity; `null` ⇒ broken reference. */
    entity: T | null;
    onOpen?: () => void;
  }
  export interface EntityCardProps<T = unknown> extends EntityChipProps<T> {}
  export interface EntityRowProps<T = unknown> {
    // `slug` is part of the real host contract (and the published types); the old
    // vendored stub omitted it. Kept here so the fallback matches the published surface.
    slug: string;
    entity: T;
    active?: boolean;
    onOpen?: () => void;
  }
  export interface EntityDetailProps {
    slug: string;
    onDeleted: () => void;
    onRenamed: (newSlug: string) => void;
    onBack: () => void;
  }
  export interface SidebarTabSlot {
    icon: ComponentType<{ className?: string; size?: number | string }>;
    label: string;
    order: number;
    emptyState?: ComponentType<unknown>;
  }
  export interface SlashCommand {
    id: string;
    label: string;
    description: string;
    hint: string;
    pluginPopoverKind?: string;
  }
  export interface EditorExtensionRegistration {
    name: string;
    extension?: unknown;
    priority?: number;
    availableIn?: string[];
    slashCommand?: SlashCommand;
  }
  // ── Phase 3 — page-routing contract (M33) ──
  // `AnyRoute` is loosely typed here (ambient fallback); the real host type comes
  // from `@tanstack/react-router`, which is a shared library peer at runtime.
  export type AnyRoute = unknown;
  export type RouteTreeFragment = (ctx: { rootRoute: AnyRoute }) => AnyRoute[];
  export interface FrontendModule extends EntityModuleManifest {
    renderChip: ComponentType<EntityChipProps<unknown>>;
    renderCard: ComponentType<EntityCardProps<unknown>>;
    renderRow: ComponentType<EntityRowProps<unknown>>;
    detailPanel: ComponentType<EntityDetailProps>;
    useGetBySlug: (slug: string | null) => {
      data: unknown | null | undefined;
      isLoading: boolean;
    };
    listByTags: (args: {
      tags: string[];
      filter: 'and' | 'or';
    }) => Promise<Array<{ slug: string }>>;
    sidebarTab?: SidebarTabSlot;
    editorExtensions?: EditorExtensionRegistration[];
    /** Phase 3 — page routes this module owns (factory bound to the host root). */
    routes?: RouteTreeFragment;
  }
  export interface EditorBridge {
    openEntity: (type: string, slug: string) => void;
    openSection: (pagePath: string, anchor: string) => void;
  }

  // ── Runtime values ──
  export const clientPluginHost: {
    registerFrontendModule(module: FrontendModule): void;
    [key: string]: unknown;
  };
  export function registerFrontendModule(module: FrontendModule): void;
  export const queryClient: unknown;
  export const editorBridge: EditorBridge;
  export function registerExtensionReferenceType(...args: unknown[]): void;
}

/**
 * Host UI Kit (L8) — presentational components shipped on the subpath specifier
 * `@c4s/plugin-runtime/ui`. Pure-presentational (props-in); the plugin still fetches
 * the data. The four components below are the `stable` core — they count into
 * `hostApiVersion` (the loader gates a prop mismatch at build time). The host source
 * is at `src/client/host-ui-kit/core/*`; the subpath is registered in
 * `src/server/core/plugin-host/runtime-shims.ts`.
 *
 * Experimental components (Badge, LoadingState, EntityListLayout, Pagination,
 * EmptyState, FormField, InlineEditField, ActionButton) also ship from this subpath
 * but are OUTSIDE `hostApiVersion` — opt-in, props may change without a major. Add
 * their declarations here if/when you import them.
 */
declare module '@c4s/plugin-runtime/ui' {
  import type { ComponentType, ReactNode, CSSProperties } from 'react';

  export interface DetailBreadcrumb {
    label: ReactNode;
    onClick?: () => void;
  }
  export interface DetailPanelShellProps {
    breadcrumb: DetailBreadcrumb[];
    actions?: ReactNode;
    children: ReactNode;
  }
  export const DetailPanelShell: ComponentType<DetailPanelShellProps>;

  export interface FieldGridProps {
    children: ReactNode;
    maxWidth?: number;
  }
  export const FieldGrid: ComponentType<FieldGridProps>;

  export interface FieldRowProps {
    label: ReactNode;
    children: ReactNode;
    align?: 'center' | 'start';
  }
  export const FieldRow: ComponentType<FieldRowProps>;

  export interface EntityListHeaderProps {
    /** Lucide-style icon component; loosely typed to avoid a `lucide-react` dep. */
    icon?: ComponentType<{ size?: number | string }>;
    title: string;
    count?: number;
    search?: string;
    onSearchChange?: (q: string) => void;
    searchPlaceholder?: string;
    filters?: ReactNode;
    actions?: ReactNode;
  }
  export const EntityListHeader: ComponentType<EntityListHeaderProps>;

  // ── Experimental-tier components (OUTSIDE hostApiVersion) ──
  // Props may change WITHOUT a major host bump — adopting them accepts an unstable
  // contract. Shapes mirror the host source `src/client/host-ui-kit/list/*` and the
  // `Tag` type from `src/shared/entities.ts`.

  /** Host tag record (slug + display metadata + per-type counts). */
  export interface Tag {
    slug: string;
    name: string;
    color: string | null;
    description: string | null;
    /** Per-entity-type counts. Keys are plugin types; absent type = 0. */
    counts: Record<string, number>;
    createdAt: string;
    updatedAt: string;
  }

  export interface EntityListRowProps {
    leading: ReactNode;
    onClick: () => void;
    /** Tag slugs to render as chips; resolved through `tagLookup`. */
    tags?: string[];
    tagLookup: Map<string, Tag>;
    trailing?: ReactNode;
    align?: 'center' | 'start';
    style?: CSSProperties;
    children: ReactNode;
  }
  export const EntityListRow: ComponentType<EntityListRowProps>;

  export interface TagBarProps {
    tags: Tag[];
    tagFilter: string[];
    onTagToggle: (slug: string) => void;
    tagMode: 'and' | 'or';
    onToggleMode: () => void;
    onClear: () => void;
  }
  export const TagFilterBar: ComponentType<TagBarProps>;
}

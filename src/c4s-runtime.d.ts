/**
 * AMBIENT FALLBACK for host types — brief section 11.1.
 *
 * `@c4s/plugin-runtime` (and `@inharness-ai/agent-adapters`) do not publish types
 * for plugin authors today. These declarations mirror the REAL host 1.0.0 contract
 * (read from the `@inharness-ai/claude4spec` source) so `npm run typecheck` passes
 * offline.
 *
 * TODO: once the host ships official types/a package, DELETE this file (the imports
 * in `src/host.ts` will resolve to the real declarations).
 *
 * The filename intentionally differs from `host.ts` — if it were named `host.d.ts`,
 * TypeScript would treat it as the declaration file FOR `host.ts` and IGNORE these
 * ambient `declare module` blocks.
 *
 * Shape sources:
 *   - src/shared/plugin-host/manifest.ts        (PluginManifest, HOST_API_VERSION)
 *   - src/shared/plugin-host/types.ts           (EntityModuleManifest, SystemPromptContribution)
 *   - src/server/core/plugin-host/types.ts      (MountContext, SqlMigration, BackendModule)
 *   - src/server/serialization/types.ts         (EntitySerializer, RestoreResult, EntityDiff)
 *   - src/client/core/plugin-host/types.ts      (FrontendModule, Entity*Props, SidebarTabSlot)
 *   - src/client/runtime/plugin-runtime.ts      (frontend runtime exports)
 *   - src/client/host-ui-kit/*                  (Host UI Kit components + props, `@c4s/plugin-runtime/ui`)
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
  import type { ComponentType, ReactNode } from 'react';

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
}

declare module '@inharness-ai/agent-adapters' {
  export interface McpServerInstance {
    name: string;
    [key: string]: unknown;
  }
  export function mcpTool(
    name: string,
    description: string,
    schema: Record<string, unknown>,
    handler: (args: Record<string, unknown>) => Promise<unknown> | unknown,
  ): unknown;
  export function createMcpServer(def: {
    name: string;
    tools: unknown[];
  }): McpServerInstance;
}

declare module 'zod' {
  export const z: any;
}

declare module '@tanstack/react-query' {
  export function useQuery(options: {
    queryKey: unknown[];
    queryFn: () => unknown;
    enabled?: boolean;
  }): { data: any; isLoading: boolean; error: unknown };
}

/**
 * Phase 3 (M33) — ambient fallback for the SHARED router peer. The plugin
 * externalizes `@tanstack/react-router` (one instance from the host import map);
 * the real types are not installed for plugin authors, so these loose shapes let
 * `npm run typecheck` pass offline. Mirrors the surface the routes fragment uses.
 */
declare module '@tanstack/react-router' {
  export type AnyRoute = any;
  export function createRoute(options: {
    getParentRoute: () => any;
    path: string;
    component: (...args: any[]) => any;
    validateSearch?: unknown;
    notFoundComponent?: (...args: any[]) => any;
  }): any;
  export function useNavigate(): (opts: any) => void;
  export function useParams(opts?: any): any;
  export function useSearch(opts?: any): any;
}

declare module 'express' {
  export interface Request {
    params: Record<string, string>;
    query: Record<string, unknown>;
    body: unknown;
  }
  export interface Response {
    status(code: number): Response;
    json(body: unknown): Response;
  }
  export type NextFunction = (err?: unknown) => void;
  export interface Router {
    get(path: string, ...handlers: unknown[]): Router;
    post(path: string, ...handlers: unknown[]): Router;
    patch(path: string, ...handlers: unknown[]): Router;
    delete(path: string, ...handlers: unknown[]): Router;
    use(...handlers: unknown[]): Router;
  }
  export function Router(): Router;
}

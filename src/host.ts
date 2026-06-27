/**
 * The single import surface for the host runtime — `@c4s/plugin-runtime` AND the
 * Host UI Kit (`@c4s/plugin-runtime/ui`).
 *
 * The rest of the plugin imports types and values FROM HERE (`../host` / `./host`),
 * so when the specifier or the surface shape changes you fix it in one place.
 *
 * NOTE: `@c4s/plugin-runtime` is NOT a runtime npm package. The backend gets it
 * from the host process; the frontend gets it via an import-map shim
 * (`window.__c4s_shared`). The `/ui` subpath is a distinct specifier on the same
 * package — it must be externalized separately in vite.config.ts.
 *
 * Its TYPES are published by the host as `@inharness-ai/claude4spec/plugin-runtime`
 * (+ `/ui`) and pulled in via `src/_host-types.d.ts` — no more vendored copy.
 * Offline / older host? See `fallback/c4s-runtime.fallback.d.ts`.
 */

// ─── Contract types (backend + cross-cutting) ───
export type {
  PluginManifest,
  PluginEngines,
  EntityContribution,
  EntityModuleManifest,
  SqlMigration,
  MountContext,
  PluginMountFn,
  EntitySerializer,
  SerializeContext,
  RestoreContext,
  RestoreResult,
  EntityDiff,
  SnapshotData,
  SystemPromptContribution,
  PluginSettingField,
  PluginSettingsModule,
  PluginCommandContribution,
  WritingStyleContribution,
} from '@c4s/plugin-runtime';

// ─── Frontend types (L5/L8) ───
export type {
  FrontendModule,
  EditorBridge,
  EditorExtensionRegistration,
  SlashCommand,
  SidebarTabSlot,
  EntityChipProps,
  EntityCardProps,
  EntityRowProps,
  EntityDetailProps,
  // Phase 3 — page-routing contract.
  RouteTreeFragment,
  AnyRoute,
} from '@c4s/plugin-runtime';

// ─── Runtime values ───
export {
  HOST_API_VERSION,
  clientPluginHost,
  registerFrontendModule,
  queryClient,
  editorBridge,
  registerExtensionReferenceType,
} from '@c4s/plugin-runtime';

// ─── Host UI Kit (L8) — @c4s/plugin-runtime/ui ───
// Pure-presentational components composed in the entity view; the plugin still
// fetches the data. The first four are the `stable` core (counted into hostApiVersion).
// `EntityListRow` and `TagFilterBar` are EXPERIMENTAL-tier (OUTSIDE hostApiVersion):
// the list view adopts them deliberately, accepting that their props may change
// without a major host bump. Other experimental components (Badge — consumed
// internally by TagFilterBar — LoadingState, EntityListLayout, Pagination, etc.)
// ship from the same subpath; re-export them here when you adopt one.
export {
  DetailPanelShell,
  FieldGrid,
  FieldRow,
  EntityListHeader,
  EntityListRow,
  TagFilterBar,
} from '@c4s/plugin-runtime/ui';
export type {
  DetailPanelShellProps,
  DetailBreadcrumb,
  FieldGridProps,
  FieldRowProps,
  EntityListHeaderProps,
  EntityListRowProps,
  TagBarProps,
  Tag,
} from '@c4s/plugin-runtime/ui';

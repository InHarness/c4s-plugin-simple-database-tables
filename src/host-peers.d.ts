/**
 * Ambient stubs for THIRD-PARTY peers the plugin externalizes but does not
 * install real `@types` for (so `npm run typecheck` passes offline). These are
 * NOT host types — the host publishes only `@c4s/plugin-runtime` (+ `/ui`), which
 * come from `@inharness-ai/claude4spec` (see `src/_host-types.d.ts`). If you add
 * real dependencies/`@types` for any of these, delete its block here.
 *
 * Loosely typed on purpose — just enough surface for the plugin's call sites.
 */

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

/**
 * L4 — the `database-table` Express router, written by hand. Mounted in `mount(ctx)`
 * via `ctx.app.use(pathPrefix, …)`; the host prepends `/api/projects/:id`, so the
 * effective paths are `/api/projects/:id/database-tables/...`.
 *
 * Routes (relative to pathPrefix `/database-tables`):
 *   GET    /              → DatabaseTableListItem[]   (derived columnCount/hasPrimaryKey)
 *   GET    /:slug         → DatabaseTableSnapshot      (404 if unknown)
 *   POST   /              → DatabaseTableSnapshot (201) + warnings[]
 *   PATCH  /:slug         → DatabaseTableSnapshot      (rename via body.newSlug)
 *   DELETE /:slug         → { deleted, danglingFks[] }
 *   POST   /:slug/restore → DatabaseTableSnapshot      (UPSERT by slug)
 */

import { Router, type Request, type Response, type NextFunction } from 'express';
import type { MountContext } from '../../host';
import { DB_TABLE_ENTITY_TYPE } from '../../identity';
import type { DatabaseTableSnapshot } from '../dto';
import type {
  CreateDatabaseTableInput,
  DatabaseTableService,
  UpdateDatabaseTableInput,
} from './services';

export function createDatabaseTableRouter(
  service: DatabaseTableService,
  ctx: MountContext,
): Router {
  const router = Router();
  const broadcast = (slug: string) =>
    ctx.ws.broadcast({ kind: 'entity:changed', entityType: DB_TABLE_ENTITY_TYPE, slug });
  const notFound = (res: Response, slug: string) =>
    res
      .status(404)
      .json({ error: { code: 'NOT_FOUND', message: `database-table '${slug}' not found` } });

  // LIST — trimmed list items.
  router.get('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const q = req.query;
      const tags = typeof q.tags === 'string' ? q.tags.split(',').filter(Boolean) : undefined;
      const tagFilter = q.tagFilter === 'and' || q.tagFilter === 'or' ? q.tagFilter : undefined;
      res.json(
        service.list({
          tags,
          tagFilter,
          search: typeof q.search === 'string' ? q.search : undefined,
          limit: q.limit ? Number(q.limit) : undefined,
          offset: q.offset ? Number(q.offset) : undefined,
        }),
      );
    } catch (err) {
      next(err);
    }
  });

  // CREATE — slug auto-derived from name; soft-FK gaps → warnings[].
  router.post('/', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { snapshot, warnings } = service.create(
        (req.body ?? {}) as CreateDatabaseTableInput,
        'user',
      );
      broadcast(snapshot.slug);
      res.status(201).json({ ...snapshot, warnings });
    } catch (err) {
      next(err);
    }
  });

  // READ — full snapshot or 404.
  router.get('/:slug', (req: Request, res: Response, next: NextFunction) => {
    try {
      const snapshot = service.getBySlug(req.params.slug);
      if (!snapshot) return notFound(res, req.params.slug);
      res.json(snapshot);
    } catch (err) {
      next(err);
    }
  });

  // UPDATE — partial; rename only via body.newSlug.
  router.patch('/:slug', (req: Request, res: Response, next: NextFunction) => {
    try {
      const { snapshot, previousSlug, warnings } = service.update(
        req.params.slug,
        (req.body ?? {}) as UpdateDatabaseTableInput,
        'user',
      );
      if (snapshot.slug !== previousSlug) broadcast(previousSlug);
      broadcast(snapshot.slug);
      res.json({ ...snapshot, warnings });
    } catch (err) {
      next(err);
    }
  });

  // DELETE — CASCADE entity_tag; soft-FKs not cascaded → danglingFks[].
  router.delete('/:slug', (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = service.remove(req.params.slug, 'user');
      if (!result.deleted) return notFound(res, req.params.slug);
      broadcast(req.params.slug);
      res.json(result);
    } catch (err) {
      next(err);
    }
  });

  // RESTORE — UPSERT by slug from a full snapshot (L9 / release restore).
  router.post('/:slug/restore', (req: Request, res: Response, next: NextFunction) => {
    try {
      const body = (req.body ?? {}) as DatabaseTableSnapshot;
      const snapshot: DatabaseTableSnapshot = { ...body, slug: req.params.slug };
      const { snapshot: restored } = service.restore(snapshot, 'user');
      broadcast(restored.slug);
      res.json(restored);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

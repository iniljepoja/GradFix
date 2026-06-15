import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { photoUpload } from '../middleware/upload.js';
import * as reports from '../services/report.service.js';
import * as photos from '../services/photo.service.js';

export const router = Router();

// GET /api/v1/reports — public list with filters, sorting, pagination.
router.get('/',
  validate({
    query: z.object({
      status: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      q: z.string().optional(),
      sort: z.enum(['recent', 'top']).default('recent'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  }),
  async (req, res, next) => {
    try {
      const { items, total } = await reports.list(req.tenant.id, req.query);
      res.json({
        data: items,
        meta: { page: req.query.page, limit: req.query.limit, total,
          totalPages: Math.ceil(total / req.query.limit) },
      });
    } catch (err) { next(err); }
  });

// GET /api/v1/reports/mine — the authenticated user's report history (must precede /:id).
router.get('/mine', authenticate,
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  }),
  async (req, res, next) => {
    try {
      const { items, total } = await reports.listMine(req.tenant.id, req.user.id, req.query);
      res.json({
        data: items,
        meta: { page: req.query.page, limit: req.query.limit, total,
          totalPages: Math.ceil(total / req.query.limit) },
      });
    } catch (err) { next(err); }
  });

// GET /api/v1/reports/:id
router.get('/:id', async (req, res, next) => {
  try { res.json({ data: await reports.getById(req.tenant.id, req.params.id) }); }
  catch (err) { next(err); }
});

// GET /api/v1/reports/:id/history
router.get('/:id/history', async (req, res, next) => {
  try { res.json({ data: await reports.history(req.tenant.id, req.params.id) }); }
  catch (err) { next(err); }
});

// POST /api/v1/reports — create (authenticated; service enforces email verification).
router.post('/', authenticate,
  validate({
    body: z.object({
      title: z.string().min(3),
      description: z.string().optional(),
      categoryId: z.string().uuid(),
      subcategoryId: z.string().uuid().optional(),
      latitude: z.number().min(-90).max(90),
      longitude: z.number().min(-180).max(180),
      address: z.string().optional(),
      priority: z.enum(['low', 'medium', 'high', 'critical']).default('medium'),
    }),
  }),
  async (req, res, next) => {
    try { res.status(201).json({ data: await reports.create(req.tenant.id, req.user.id, req.body) }); }
    catch (err) { next(err); }
  });

// Staff status management lives in the admin router (/api/v1/admin/reports/:id/status).

// POST/DELETE /api/v1/reports/:id/upvote — authenticated, idempotent.
router.post('/:id/upvote', authenticate, async (req, res, next) => {
  try { res.json({ data: await reports.upvote(req.tenant.id, req.params.id, req.user.id) }); }
  catch (err) { next(err); }
});

router.delete('/:id/upvote', authenticate, async (req, res, next) => {
  try { res.json({ data: await reports.removeUpvote(req.tenant.id, req.params.id, req.user.id) }); }
  catch (err) { next(err); }
});

// POST /api/v1/reports/:id/photos — owner uploads up to 3 compressed photos (multipart, field "photos").
router.post('/:id/photos', authenticate, photoUpload, async (req, res, next) => {
  try {
    const created = await photos.addPhotos(req.tenant.id, req.params.id, req.user.id, req.files);
    res.status(201).json({ data: created });
  } catch (err) { next(err); }
});

// POST /api/v1/reports/:id/rating — reporter rates the resolution (satisfied + optional comment).
router.post('/:id/rating', authenticate,
  validate({ body: z.object({ satisfied: z.boolean(), comment: z.string().max(2000).optional() }) }),
  async (req, res, next) => {
    try {
      res.json({ data: await reports.rateResolution(req.tenant.id, req.params.id, req.user.id, req.body) });
    } catch (err) { next(err); }
  });

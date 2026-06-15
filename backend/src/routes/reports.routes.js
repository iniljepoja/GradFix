import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import * as reports from '../services/report.service.js';

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

// PATCH /api/v1/reports/:id/status — moderator/admin; records history.
router.patch('/:id/status', authenticate, authorize('moderator', 'admin'),
  validate({
    body: z.object({
      toStatus: z.enum(['submitted', 'acknowledged', 'in_progress', 'resolved', 'rejected', 'duplicate']),
      note: z.string().optional(),
    }),
  }),
  async (req, res, next) => {
    try {
      res.json({ data: await reports.changeStatus(req.tenant.id, req.params.id, req.user.id, req.body) });
    } catch (err) { next(err); }
  });

// POST/DELETE /api/v1/reports/:id/upvote — authenticated, idempotent.
router.post('/:id/upvote', authenticate, async (req, res, next) => {
  try { res.json({ data: await reports.upvote(req.tenant.id, req.params.id, req.user.id) }); }
  catch (err) { next(err); }
});

router.delete('/:id/upvote', authenticate, async (req, res, next) => {
  try { res.json({ data: await reports.removeUpvote(req.tenant.id, req.params.id, req.user.id) }); }
  catch (err) { next(err); }
});

// POST /api/v1/reports/:id/photos — multipart upload (multer) added in week 3.

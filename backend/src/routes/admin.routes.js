import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import * as admin from '../services/admin.service.js';
import * as entities from '../services/entity.service.js';
import * as categories from '../services/category.service.js';
import { changeStatus } from '../services/report.service.js';
import { adminStats } from '../services/stats.service.js';

export const router = Router();

// All /admin routes require an authenticated staff member; super_admin always passes.
const STAFF = ['reviewer', 'conductor', 'community_manager', 'tenant_admin'];
router.use(authenticate, authorize(...STAFF));
const tenantAdmin = authorize('tenant_admin'); // tenant configuration; super_admin still passes

// Per-action role separation (super_admin passes everything via authorize):
//   reviewer          → triage: change status, set priority, merge duplicates
//   conductor         → operations: change status, assign to a responsible entity
//   community_manager → citizen communication: comments only (read + comment)
//   tenant_admin      → all of the above + tenant configuration & user management
const canReview = authorize('reviewer', 'tenant_admin');                  // priority, merge
const canChangeStatus = authorize('reviewer', 'conductor', 'tenant_admin');
const canAssign = authorize('conductor', 'tenant_admin');

const STATUS = z.enum(['accepted', 'assigned', 'in_progress', 'resolved', 'closed']);
const PRIORITY = z.enum(['low', 'medium', 'high', 'critical']);
const ENTITY_TYPE = z.enum(['company', 'ngo', 'informal_group', 'department']);
const ASSIGNABLE_ROLE = z.enum(['citizen', 'reviewer', 'conductor', 'community_manager', 'tenant_admin']);

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };

// ── Dashboard statistics ────────────────────────────────────────────────────
router.get('/stats', wrap(async (req, res) => {
  res.json({ data: await adminStats(req.tenant.id) });
}));

// ── Report management ──────────────────────────────────────────────────────
router.get('/reports',
  validate({
    query: z.object({
      status: z.string().optional(),
      priority: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      assignedEntityId: z.string().uuid().optional(),
      q: z.string().optional(),
      sort: z.enum(['recent', 'top', 'priority']).default('recent'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(100).default(20),
    }),
  }),
  wrap(async (req, res) => {
    const { items, total } = await admin.listReports(req.tenant.id, req.query);
    res.json({ data: items, meta: { page: req.query.page, limit: req.query.limit, total,
      totalPages: Math.ceil(total / req.query.limit) } });
  }));

router.get('/reports/:id',
  wrap(async (req, res) => { res.json({ data: await admin.getReport(req.tenant.id, req.params.id) }); }));

router.patch('/reports/:id/status', canChangeStatus,
  validate({ body: z.object({ toStatus: STATUS, note: z.string().optional() }) }),
  wrap(async (req, res) => {
    res.json({ data: await changeStatus(req.tenant.id, req.params.id, req.user.id, req.body) });
  }));

router.patch('/reports/:id/priority', canReview,
  validate({ body: z.object({ priority: PRIORITY }) }),
  wrap(async (req, res) => {
    res.json({ data: await admin.updatePriority(req.tenant.id, req.params.id, req.body.priority) });
  }));

// entityId optional → falls back to the category's automatic route.
router.patch('/reports/:id/assign', canAssign,
  validate({ body: z.object({ entityId: z.string().uuid().optional() }) }),
  wrap(async (req, res) => {
    res.json({ data: await admin.assignEntity(req.tenant.id, req.params.id, req.body.entityId, req.user.id) });
  }));

router.post('/reports/:id/merge', canReview,
  validate({ body: z.object({ canonicalId: z.string().uuid() }) }),
  wrap(async (req, res) => {
    res.json({ data: await admin.mergeDuplicate(req.tenant.id, req.params.id, req.body.canonicalId, req.user.id) });
  }));

router.get('/reports/:id/comments',
  wrap(async (req, res) => { res.json({ data: await admin.listComments(req.tenant.id, req.params.id) }); }));

router.post('/reports/:id/comments',
  validate({ body: z.object({ body: z.string().min(1), isInternal: z.boolean().default(true) }) }),
  wrap(async (req, res) => {
    res.status(201).json({ data: await admin.addComment(req.tenant.id, req.params.id, req.user.id, req.body) });
  }));

// ── Responsible entities & routing ──────────────────────────────────────────
router.get('/entities', wrap(async (req, res) => {
  res.json({ data: await entities.listEntities(req.tenant.id) });
}));

router.post('/entities', tenantAdmin,
  validate({ body: z.object({
    name: z.string().min(1), type: ENTITY_TYPE.default('company'),
    email: z.string().email().optional(), phone: z.string().optional(),
  }) }),
  wrap(async (req, res) => { res.status(201).json({ data: await entities.createEntity(req.tenant.id, req.body) }); }));

router.patch('/entities/:id', tenantAdmin,
  validate({ body: z.object({
    name: z.string().min(1).optional(), type: ENTITY_TYPE.optional(),
    email: z.string().email().optional(), phone: z.string().optional(), isActive: z.boolean().optional(),
  }) }),
  wrap(async (req, res) => { res.json({ data: await entities.updateEntity(req.tenant.id, req.params.id, req.body) }); }));

router.get('/routes', wrap(async (req, res) => {
  res.json({ data: await entities.listRoutes(req.tenant.id) });
}));

router.put('/categories/:id/route', tenantAdmin,
  validate({ body: z.object({ entityId: z.string().uuid() }) }),
  wrap(async (req, res) => {
    res.json({ data: await entities.setCategoryRoute(req.tenant.id, req.params.id, req.body.entityId) });
  }));

// ── Category / subcategory configuration ────────────────────────────────────
router.post('/categories', tenantAdmin,
  validate({ body: z.object({
    name: z.string().min(1), slug: z.string().optional(), icon: z.string().optional(),
    sortOrder: z.number().int().optional(),
  }) }),
  wrap(async (req, res) => { res.status(201).json({ data: await categories.createCategory(req.tenant.id, req.body) }); }));

router.patch('/categories/:id', tenantAdmin,
  validate({ body: z.object({
    name: z.string().min(1).optional(), slug: z.string().optional(), icon: z.string().optional(),
    sortOrder: z.number().int().optional(), isActive: z.boolean().optional(),
  }) }),
  wrap(async (req, res) => { res.json({ data: await categories.updateCategory(req.tenant.id, req.params.id, req.body) }); }));

router.delete('/categories/:id', tenantAdmin,
  wrap(async (req, res) => { res.json({ data: await categories.deactivateCategory(req.tenant.id, req.params.id) }); }));

router.post('/categories/:id/subcategories', tenantAdmin,
  validate({ body: z.object({
    name: z.string().min(1), slug: z.string().optional(), sortOrder: z.number().int().optional(),
  }) }),
  wrap(async (req, res) => {
    res.status(201).json({ data: await categories.createSubcategory(req.tenant.id, req.params.id, req.body) });
  }));

router.delete('/subcategories/:id', tenantAdmin,
  wrap(async (req, res) => { res.json({ data: await categories.deactivateSubcategory(req.tenant.id, req.params.id) }); }));

// ── Users & roles ───────────────────────────────────────────────────────────
router.get('/users', tenantAdmin, wrap(async (req, res) => {
  res.json({ data: await admin.listUsers(req.tenant.id) });
}));

router.patch('/users/:id/role', tenantAdmin,
  validate({ body: z.object({ role: ASSIGNABLE_ROLE }) }),
  wrap(async (req, res) => {
    res.json({ data: await admin.updateUserRole(req.tenant.id, req.params.id, req.body.role) });
  }));

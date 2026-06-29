import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate, authorize } from '../middleware/auth.js';
import * as admin from '../services/admin.service.js';
import * as entities from '../services/entity.service.js';
import * as categories from '../services/category.service.js';
import * as workOrders from '../services/work-order.service.js';
import * as platform from '../services/platform.service.js';
import { changeStatus } from '../services/report.service.js';
import { adminStats } from '../services/stats.service.js';
import { ApiError } from '../utils/ApiError.js';

export const router = Router();

router.use(authenticate);
const tenantAdmin = (req, _res, next) => {
  if (req.user?.role !== 'tenant_admin') return next(ApiError.forbidden('Tenant Admin account required'));
  next();
};
const canReview = tenantAdmin;
const canChangeStatus = tenantAdmin;
const canAssign = tenantAdmin;
const canManageWorkOrders = tenantAdmin;
const superAdmin = authorize('super_admin');

const STATUS = z.enum(['accepted', 'assigned', 'in_progress', 'resolved', 'closed']);
const WORK_ORDER_STATUS = z.enum(workOrders.WORK_ORDER_STATUSES);
const PRIORITY = z.enum(['low', 'medium', 'high', 'critical']);
const ENTITY_TYPE = z.enum(entities.ENTITY_TYPES);
const ASSIGNABLE_ROLE = z.enum(['citizen', 'tenant_admin']);
const UUID = z.string().uuid();

const wrap = (fn) => async (req, res, next) => { try { await fn(req, res); } catch (err) { next(err); } };

// ── Main admin / platform-wide views ────────────────────────────────────────
router.get('/platform/tenants', superAdmin, wrap(async (req, res) => {
  res.json({ data: await platform.listTenants() });
}));

router.post('/platform/tenants', superAdmin,
  validate({ body: z.object({
    name: z.string().min(1), slug: z.string().min(2).regex(/^[a-z0-9-]+$/),
    centerLat: z.number().optional(), centerLng: z.number().optional(),
  }) }),
  wrap(async (req, res) => { res.status(201).json({ data: await platform.createTenant(req.body) }); }));

router.patch('/platform/tenants/:id', superAdmin,
  validate({ params: z.object({ id: UUID }), body: z.object({
    name: z.string().min(1).optional(), centerLat: z.number().nullable().optional(),
    centerLng: z.number().nullable().optional(), isActive: z.boolean().optional(),
  }) }),
  wrap(async (req, res) => { res.json({ data: await platform.updateTenant(req.params.id, req.body) }); }));

router.get('/platform/tenants/:id/stats', superAdmin,
  validate({ params: z.object({ id: UUID }) }),
  wrap(async (req, res) => { res.json({ data: await platform.tenantStats(req.params.id) }); }));

router.get('/platform/reports', superAdmin,
  validate({ query: z.object({ tenantId: UUID.optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50) }) }),
  wrap(async (req, res) => {
    const { items, total, page, limit } = await platform.listReports(req.query);
    res.json({ data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }));

router.get('/platform/work-orders', superAdmin,
  validate({ query: z.object({ tenantId: UUID.optional(), page: z.coerce.number().int().min(1).default(1), limit: z.coerce.number().int().min(1).max(100).default(50) }) }),
  wrap(async (req, res) => {
    const { items, total, page, limit } = await platform.listWorkOrders(req.query);
    res.json({ data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }));

router.get('/platform/entities', superAdmin,
  validate({ query: z.object({ tenantId: UUID.optional() }) }),
  wrap(async (req, res) => { res.json({ data: await platform.listEntities(req.query) }); }));

router.post('/platform/entities', superAdmin,
  validate({ body: z.object({
    tenantId: UUID, name: z.string().min(1), type: ENTITY_TYPE.default('municipal_department'),
    email: z.string().email().optional(), phone: z.string().max(60).optional(), notes: z.string().max(2000).optional(),
  }) }),
  wrap(async (req, res) => {
    const { tenantId, ...body } = req.body;
    res.status(201).json({ data: await entities.createEntity(tenantId, body) });
  }));

router.get('/platform/tenant-admins', superAdmin,
  validate({ query: z.object({ tenantId: UUID.optional() }) }),
  wrap(async (req, res) => { res.json({ data: await platform.listTenantAdmins(req.query.tenantId) }); }));

router.post('/platform/tenant-admins', superAdmin,
  validate({ body: z.object({ tenantId: UUID, email: z.string().email(), password: z.string().min(8), fullName: z.string().min(1) }) }),
  wrap(async (req, res) => { res.status(201).json({ data: await platform.createTenantAdmin(req.body) }); }));

// Everything below this point is city operations/configuration and belongs to Tenant Admin only.
router.use(tenantAdmin);

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
  validate({ body: z.object({ toStatus: STATUS, note: z.string().trim().min(1).max(2000).optional() }) }),
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
  validate({ body: z.object({ canonicalId: z.string().uuid(), note: z.string().trim().min(1).max(2000) }) }),
  wrap(async (req, res) => {
    res.json({ data: await admin.mergeDuplicate(req.tenant.id, req.params.id, req.body.canonicalId, req.user.id, req.body.note) });
  }));

router.get('/reports/:id/assignment-history', wrap(async (req, res) => {
  res.json({ data: await admin.listAssignmentHistory(req.tenant.id, req.params.id) });
}));

router.get('/reports/:id/comments',
  wrap(async (req, res) => { res.json({ data: await admin.listComments(req.tenant.id, req.params.id) }); }));

router.post('/reports/:id/comments',
  validate({ body: z.object({ body: z.string().min(1), isInternal: z.boolean().default(true) }) }),
  wrap(async (req, res) => {
    res.status(201).json({ data: await admin.addComment(req.tenant.id, req.params.id, req.user.id, req.body) });
  }));

// ── Work orders ─────────────────────────────────────────────────────────────
router.get('/work-orders',
  validate({ query: z.object({
    status: WORK_ORDER_STATUS.optional(),
    reportId: UUID.optional(),
    assignedEntityId: UUID.optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(50),
  }) }),
  wrap(async (req, res) => {
    const { items, total, page, limit } = await workOrders.list(req.tenant.id, req.query);
    res.json({ data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } });
  }));

router.get('/reports/:id/work-orders', wrap(async (req, res) => {
  res.json({ data: await workOrders.listForReport(req.tenant.id, req.params.id) });
}));

router.post('/reports/:id/work-orders', canManageWorkOrders,
  validate({ body: z.object({
    entityId: z.string().uuid().optional(),
    title: z.string().min(3).max(200).optional(),
    description: z.string().max(4000).optional(),
    dueAt: z.string().datetime().optional(),
  }) }),
  wrap(async (req, res) => {
    const data = await workOrders.createWorkOrder(req.tenant.id, req.params.id, req.user.id, req.body);
    res.status(201).json({ data });
  }));

router.get('/work-orders/:id', wrap(async (req, res) => {
  res.json({ data: await workOrders.getById(req.tenant.id, req.params.id) });
}));

router.patch('/work-orders/:id/status', canManageWorkOrders,
  validate({ body: z.object({ toStatus: WORK_ORDER_STATUS, note: z.string().trim().min(1).max(2000).optional() }) }),
  wrap(async (req, res) => {
    res.json({ data: await workOrders.changeWorkOrderStatus(req.tenant.id, req.params.id, req.user.id, req.body) });
  }));

// Generate (or regenerate) an immutable PDF document version for a work order without emailing it.
router.post('/work-orders/:id/document', canManageWorkOrders,
  wrap(async (req, res) => {
    res.status(201).json({ data: await workOrders.regenerateDocument(req.tenant.id, req.params.id, req.user.id) });
  }));

// Issuing a work order: generate an immutable PDF snapshot and email it to the responsible entity.
// Records a delivery attempt; transitions the work order to `sent` or `delivery_failed`.
router.post('/work-orders/:id/send', canManageWorkOrders,
  validate({ body: z.object({ regenerate: z.boolean().default(false) }).optional() }),
  wrap(async (req, res) => {
    res.json({ data: await workOrders.sendWorkOrder(req.tenant.id, req.params.id, req.user.id, req.body ?? {}) });
  }));

// Download the current (latest) immutable PDF document for a work order.
router.get('/work-orders/:id/document', wrap(async (req, res) => {
  const { buffer, fileName, contentType } = await workOrders.downloadDocumentFile(req.tenant.id, req.params.id);
  res.setHeader('Content-Type', contentType);
  res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
  res.send(buffer);
}));

// ── Responsible entities & routing ──────────────────────────────────────────
router.get('/entities', wrap(async (req, res) => {
  res.json({ data: await entities.listEntities(req.tenant.id) });
}));

router.post('/entities', tenantAdmin,
  validate({ body: z.object({
    name: z.string().min(1), type: ENTITY_TYPE.default('company'),
    email: z.string().email().optional(), phone: z.string().max(60).optional(), notes: z.string().max(2000).optional(),
  }) }),
  wrap(async (req, res) => { res.status(201).json({ data: await entities.createEntity(req.tenant.id, req.body) }); }));

router.patch('/entities/:id', tenantAdmin,
  validate({ body: z.object({
    name: z.string().min(1).optional(), type: ENTITY_TYPE.optional(),
    email: z.string().email().nullable().optional(), phone: z.string().max(60).nullable().optional(),
    notes: z.string().max(2000).nullable().optional(), isActive: z.boolean().optional(),
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

import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { notifyStatusChange } from './notification.service.js';
import { processFiles, insertPhotoRows } from './photo.service.js';

// Allowed status transitions per the spec lifecycle:
// new → accepted → assigned → in_progress → resolved → closed (with reopen + early-close paths).
export const STATUS_TRANSITIONS = {
  new: ['accepted', 'closed'],
  accepted: ['assigned', 'in_progress', 'closed'],
  assigned: ['in_progress', 'closed'],
  in_progress: ['resolved', 'closed'],
  resolved: ['closed', 'in_progress'],
  closed: [],
};

export function requiresStatusReason(from, to) {
  return to === 'closed' || (from === 'resolved' && to === 'in_progress');
}

export function requiresStartedWorkOrder(from, to) {
  return to === 'in_progress' && from !== 'resolved';
}

export function assertTransition(from, to, note) {
  if (from === to) throw ApiError.badRequest(`Report is already "${to}"`);
  if (!STATUS_TRANSITIONS[from]?.includes(to)) {
    throw ApiError.badRequest(`Illegal status transition: ${from} → ${to}`);
  }
  if (requiresStatusReason(from, to) && !note?.trim()) {
    throw ApiError.badRequest('A reason is required for this status change');
  }
}

export async function list(tenantId, { status, categoryId, q, sort, page, limit }) {
  const where = ['tenant_id = $1'];
  const params = [tenantId];
  if (status) { params.push(status); where.push(`status = $${params.length}`); }
  if (categoryId) { params.push(categoryId); where.push(`category_id = $${params.length}`); }
  if (q) { params.push(`%${q}%`); where.push(`(title ILIKE $${params.length} OR description ILIKE $${params.length})`); }

  const orderBy = sort === 'top' ? 'upvote_count DESC, created_at DESC' : 'created_at DESC';
  const whereSql = where.join(' AND ');

  const { rows: countRows } = await query(`SELECT count(*)::int AS total FROM reports WHERE ${whereSql}`, params);
  const offset = (page - 1) * limit;
  const { rows } = await query(
    `SELECT id, title, status, priority, category_id AS "categoryId",
            latitude, longitude, upvote_count AS "upvoteCount", created_at AS "createdAt"
     FROM reports WHERE ${whereSql}
     ORDER BY ${orderBy}
     LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return { items: rows, total: countRows[0].total };
}

export async function getById(tenantId, id) {
  const { rows } = await query(
    `SELECT id, title, description, status, priority, category_id AS "categoryId",
            subcategory_id AS "subcategoryId", latitude, longitude, address,
            upvote_count AS "upvoteCount", created_at AS "createdAt", resolved_at AS "resolvedAt"
     FROM reports WHERE tenant_id = $1 AND id = $2`,
    [tenantId, id],
  );
  if (!rows[0]) throw ApiError.notFound('Report not found');
  const { rows: photos } = await query(
    `SELECT id, url, width, height FROM report_photos WHERE report_id = $1 ORDER BY created_at`,
    [id],
  );
  return { ...rows[0], photos };
}

// Automatic routing: the default responsible entity configured for a category (or null).
export async function routeForCategory(tenantId, categoryId) {
  const { rows } = await query(
    `SELECT cr.responsible_entity_id AS id
     FROM category_routes cr JOIN categories c ON c.id = cr.category_id
     WHERE cr.category_id = $1 AND c.tenant_id = $2`,
    [categoryId, tenantId]);
  return rows[0]?.id ?? null;
}

// Create a report with its mandatory photos (1–3, compressed) in one atomic step.
// The responsible entity is auto-resolved from the category's routing configuration.
export async function createReport(tenantId, reporterId, body, files) {
  const { rows: u } = await query('SELECT is_email_verified FROM users WHERE id = $1', [reporterId]);
  if (!u[0]?.is_email_verified) throw new ApiError(403, 'EMAIL_NOT_VERIFIED', 'Verify your email first');
  if (!files?.length) throw ApiError.badRequest('At least one photo is required');

  const { rows: cat } = await query(
    'SELECT id FROM categories WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE',
    [body.categoryId, tenantId]);
  if (!cat[0]) throw ApiError.badRequest('Unknown category for this tenant');
  if (body.subcategoryId) {
    const { rows: sub } = await query(
      'SELECT id FROM subcategories WHERE id = $1 AND category_id = $2',
      [body.subcategoryId, body.categoryId]);
    if (!sub[0]) throw ApiError.badRequest('Subcategory does not belong to the category');
  }

  const assignedEntityId = await routeForCategory(tenantId, body.categoryId);
  // Compress/write files before the transaction; orphaned files on rollback are harmless.
  const metas = await processFiles(tenantId, files);

  return withTransaction(async (c) => {
    const { rows } = await c.query(
      `INSERT INTO reports
         (tenant_id, reporter_id, category_id, subcategory_id, title, description,
          latitude, longitude, address, priority, assigned_entity_id)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
       RETURNING id, status, priority, assigned_entity_id AS "assignedEntityId",
                 upvote_count AS "upvoteCount", created_at AS "createdAt"`,
      [tenantId, reporterId, body.categoryId, body.subcategoryId ?? null, body.title,
        body.description ?? null, body.latitude, body.longitude, body.address ?? null,
        body.priority, assignedEntityId],
    );
    const report = rows[0];
    const photos = await insertPhotoRows(c, report.id, metas, { existing: 0 });
    return { ...report, photos };
  });
}

export async function history(tenantId, reportId) {
  await assertReportInTenant(tenantId, reportId);
  const { rows } = await query(
    `SELECT from_status AS "fromStatus", to_status AS "toStatus", note,
            changed_by AS "changedBy", created_at AS "createdAt"
     FROM report_status_history WHERE report_id = $1 ORDER BY created_at`,
    [reportId],
  );
  return rows;
}

export async function changeStatus(tenantId, reportId, userId, { toStatus, note }) {
  const result = await withTransaction(async (c) => {
    const { rows } = await c.query(
      'SELECT status, title FROM reports WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [reportId, tenantId],
    );
    if (!rows[0]) throw ApiError.notFound('Report not found');
    const fromStatus = rows[0].status;
    assertTransition(fromStatus, toStatus, note);
    if (requiresStartedWorkOrder(fromStatus, toStatus)) {
      await assertHasStartedWorkOrder(c, tenantId, reportId);
    }
    if (['resolved', 'closed'].includes(toStatus)) {
      await assertNoActiveWorkOrders(c, tenantId, reportId, `Cannot mark report ${toStatus} while active work orders exist`);
    }

    const resolvedAt = toStatus === 'resolved' ? 'now()' : 'resolved_at';
    const closedAt = toStatus === 'closed' ? 'now()' : 'closed_at';
    await c.query(
      `UPDATE reports SET status = $1, resolved_at = ${resolvedAt}, closed_at = ${closedAt} WHERE id = $2`,
      [toStatus, reportId],
    );
    await c.query(
      `INSERT INTO report_status_history (report_id, changed_by, from_status, to_status, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [reportId, userId, fromStatus, toStatus, note ?? null],
    );
    return { id: reportId, fromStatus, status: toStatus, title: rows[0].title };
  });

  // Notify after commit so a mailer failure can't roll back the status change.
  notifyStatusChange({ reportId, title: result.title, toStatus }).catch((err) =>
    console.error('Status notification failed:', err.message));

  return { id: result.id, fromStatus: result.fromStatus, status: result.status };
}

export async function assertNoActiveWorkOrders(c, tenantId, reportId, message) {
  const { rows } = await c.query(
    `SELECT id FROM work_orders
     WHERE tenant_id = $1 AND report_id = $2
       AND status IN ('draft', 'sent', 'delivery_failed', 'in_progress')
     LIMIT 1`,
    [tenantId, reportId],
  );
  if (rows[0]) throw ApiError.conflict(message);
}

async function assertHasStartedWorkOrder(c, tenantId, reportId) {
  const { rows } = await c.query(
    `SELECT id FROM work_orders
     WHERE tenant_id = $1 AND report_id = $2 AND status IN ('sent', 'in_progress')
     LIMIT 1`,
    [tenantId, reportId],
  );
  if (!rows[0]) throw ApiError.conflict('Cannot mark report in progress before a Work Order is sent or started');
}

// Reports filed by a given user (profile history), most recent first.
export async function listMine(tenantId, userId, { page = 1, limit = 20 } = {}) {
  const offset = (page - 1) * limit;
  const { rows: countRows } = await query(
    'SELECT count(*)::int AS total FROM reports WHERE tenant_id = $1 AND reporter_id = $2',
    [tenantId, userId]);
  const { rows } = await query(
    `SELECT id, title, status, priority, category_id AS "categoryId",
            upvote_count AS "upvoteCount", created_at AS "createdAt", resolved_at AS "resolvedAt"
     FROM reports WHERE tenant_id = $1 AND reporter_id = $2
     ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    [tenantId, userId]);
  return { items: rows, total: countRows[0].total };
}

// The reporter rates the resolution (one rating per report, only once resolved/closed).
export async function rateResolution(tenantId, reportId, userId, { satisfied, comment }) {
  const { rows } = await query(
    'SELECT reporter_id, status FROM reports WHERE id = $1 AND tenant_id = $2', [reportId, tenantId]);
  if (!rows[0]) throw ApiError.notFound('Report not found');
  if (rows[0].reporter_id !== userId) throw ApiError.forbidden('Only the reporter can rate resolution');
  if (!['resolved', 'closed'].includes(rows[0].status)) {
    throw ApiError.badRequest('Report is not resolved yet');
  }
  const { rows: ins } = await query(
    `INSERT INTO report_ratings (report_id, rated_by, satisfied, comment)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (report_id) DO UPDATE SET satisfied = EXCLUDED.satisfied, comment = EXCLUDED.comment
     RETURNING satisfied, comment, created_at AS "createdAt"`,
    [reportId, userId, satisfied, comment ?? null]);
  return ins[0];
}

// Count of reports filed by a user — used for gamification badges.
export async function reporterReportCount(userId) {
  const { rows } = await query('SELECT count(*)::int AS n FROM reports WHERE reporter_id = $1', [userId]);
  return rows[0].n;
}

export async function upvote(tenantId, reportId, userId) {
  await assertReportInTenant(tenantId, reportId);
  return withTransaction(async (c) => {
    const { rowCount } = await c.query(
      `INSERT INTO upvotes (report_id, user_id) VALUES ($1, $2)
       ON CONFLICT (report_id, user_id) DO NOTHING`,
      [reportId, userId],
    );
    if (rowCount === 1) {
      await c.query('UPDATE reports SET upvote_count = upvote_count + 1 WHERE id = $1', [reportId]);
    }
    const { rows } = await c.query('SELECT upvote_count AS "upvoteCount" FROM reports WHERE id = $1', [reportId]);
    return { upvoted: true, ...rows[0] };
  });
}

export async function removeUpvote(tenantId, reportId, userId) {
  await assertReportInTenant(tenantId, reportId);
  return withTransaction(async (c) => {
    const { rowCount } = await c.query('DELETE FROM upvotes WHERE report_id = $1 AND user_id = $2',
      [reportId, userId]);
    if (rowCount === 1) {
      await c.query('UPDATE reports SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = $1', [reportId]);
    }
    const { rows } = await c.query('SELECT upvote_count AS "upvoteCount" FROM reports WHERE id = $1', [reportId]);
    return { upvoted: false, ...rows[0] };
  });
}

async function assertReportInTenant(tenantId, reportId) {
  const { rows } = await query('SELECT 1 FROM reports WHERE id = $1 AND tenant_id = $2', [reportId, tenantId]);
  if (!rows[0]) throw ApiError.notFound('Report not found');
}

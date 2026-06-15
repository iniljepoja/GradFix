import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

// Admin report listing: filters + search + pagination, including private fields
// (reporter, assigned entity, duplicate linkage) that the public list omits.
export async function listReports(tenantId, f) {
  const where = ['r.tenant_id = $1'];
  const params = [tenantId];
  const add = (cond, val) => { params.push(val); where.push(cond.replace('?', `$${params.length}`)); };

  if (f.status) add('r.status = ?', f.status);
  if (f.priority) add('r.priority = ?', f.priority);
  if (f.categoryId) add('r.category_id = ?', f.categoryId);
  if (f.assignedEntityId) add('r.assigned_entity_id = ?', f.assignedEntityId);
  if (f.q) { params.push(`%${f.q}%`); where.push(`(r.title ILIKE $${params.length} OR r.description ILIKE $${params.length})`); }

  const whereSql = where.join(' AND ');
  const orderBy = f.sort === 'top' ? 'r.upvote_count DESC, r.created_at DESC'
    : f.sort === 'priority' ? "array_position(ARRAY['critical','high','medium','low']::text[], r.priority::text), r.created_at DESC"
      : 'r.created_at DESC';

  const { rows: countRows } = await query(`SELECT count(*)::int AS total FROM reports r WHERE ${whereSql}`, params);
  const offset = (f.page - 1) * f.limit;
  const { rows } = await query(
    `SELECT r.id, r.title, r.status, r.priority, r.category_id AS "categoryId",
            r.reporter_id AS "reporterId", u.email AS "reporterEmail",
            r.assigned_entity_id AS "assignedEntityId", e.name AS "assignedEntityName",
            r.duplicate_of_id AS "duplicateOfId",
            r.latitude, r.longitude, r.upvote_count AS "upvoteCount",
            r.created_at AS "createdAt", r.resolved_at AS "resolvedAt", r.closed_at AS "closedAt"
     FROM reports r
     LEFT JOIN users u ON u.id = r.reporter_id
     LEFT JOIN responsible_entities e ON e.id = r.assigned_entity_id
     WHERE ${whereSql}
     ORDER BY ${orderBy}
     LIMIT ${f.limit} OFFSET ${offset}`,
    params,
  );
  return { items: rows, total: countRows[0].total };
}

async function loadReport(tenantId, reportId, client = null) {
  const runner = client ?? { query };
  const { rows } = await runner.query(
    `SELECT id, status, category_id, assigned_entity_id, duplicate_of_id
     FROM reports WHERE id = $1 AND tenant_id = $2`,
    [reportId, tenantId]);
  if (!rows[0]) throw ApiError.notFound('Report not found');
  return rows[0];
}

export async function updatePriority(tenantId, reportId, priority) {
  await loadReport(tenantId, reportId);
  const { rows } = await query(
    `UPDATE reports SET priority = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id, priority`,
    [priority, reportId, tenantId]);
  return rows[0];
}

// Assign a report to a responsible entity. The report must be accepted first; an accepted report
// transitions to "assigned" (with status history); an already-assigned/in-progress report is just
// re-pointed at a new entity. If entityId is omitted, the category's automatic route is used.
export async function assignEntity(tenantId, reportId, entityId, userId) {
  return withTransaction(async (c) => {
    const report = await loadReport(tenantId, reportId, c);
    if (report.status === 'new') throw ApiError.badRequest('Accept the report before assigning it');
    if (['resolved', 'closed'].includes(report.status)) {
      throw ApiError.badRequest(`Cannot assign a ${report.status} report`);
    }

    let target = entityId;
    if (!target) {
      const { rows } = await c.query(
        'SELECT responsible_entity_id AS id FROM category_routes WHERE category_id = $1',
        [report.category_id]);
      target = rows[0]?.id;
      if (!target) throw ApiError.badRequest('No entity provided and no route configured for the category');
    }

    const { rows: ent } = await c.query(
      'SELECT id FROM responsible_entities WHERE id = $1 AND tenant_id = $2 AND is_active = TRUE',
      [target, tenantId]);
    if (!ent[0]) throw ApiError.badRequest('Unknown responsible entity for this tenant');

    await c.query('UPDATE reports SET assigned_entity_id = $1 WHERE id = $2', [target, reportId]);
    if (report.status === 'accepted') {
      await c.query('UPDATE reports SET status = $1 WHERE id = $2', ['assigned', reportId]);
      await c.query(
        `INSERT INTO report_status_history (report_id, changed_by, from_status, to_status, note)
         VALUES ($1, $2, 'accepted', 'assigned', 'Assigned to responsible entity')`,
        [reportId, userId]);
    }
    return { id: reportId, assignedEntityId: target };
  });
}

// Merge a duplicate into a canonical report: link it and close it (append status history).
export async function mergeDuplicate(tenantId, duplicateId, canonicalId, userId) {
  if (duplicateId === canonicalId) throw ApiError.badRequest('A report cannot be a duplicate of itself');
  return withTransaction(async (c) => {
    const dup = await loadReport(tenantId, duplicateId, c);
    const canonical = await loadReport(tenantId, canonicalId, c);
    if (canonical.duplicate_of_id) throw ApiError.badRequest('Canonical report is itself a duplicate');
    if (dup.status === 'closed') throw ApiError.badRequest('Duplicate is already closed');

    await c.query('UPDATE reports SET duplicate_of_id = $1, status = $2, closed_at = now() WHERE id = $3',
      [canonicalId, 'closed', duplicateId]);
    await c.query(
      `INSERT INTO report_status_history (report_id, changed_by, from_status, to_status, note)
       VALUES ($1, $2, $3, 'closed', $4)`,
      [duplicateId, userId, dup.status, `Merged into ${canonicalId}`]);
    return { id: duplicateId, duplicateOfId: canonicalId, status: 'closed' };
  });
}

export async function addComment(tenantId, reportId, authorId, { body, isInternal = true }) {
  await loadReport(tenantId, reportId);
  const { rows } = await query(
    `INSERT INTO report_comments (report_id, author_id, body, is_internal)
     VALUES ($1, $2, $3, $4)
     RETURNING id, body, is_internal AS "isInternal", created_at AS "createdAt"`,
    [reportId, authorId, body, isInternal]);
  return rows[0];
}

export async function listComments(tenantId, reportId) {
  await loadReport(tenantId, reportId);
  const { rows } = await query(
    `SELECT c.id, c.body, c.is_internal AS "isInternal", c.author_id AS "authorId",
            u.full_name AS "authorName", c.created_at AS "createdAt"
     FROM report_comments c LEFT JOIN users u ON u.id = c.author_id
     WHERE c.report_id = $1 ORDER BY c.created_at`,
    [reportId]);
  return rows;
}

export async function listUsers(tenantId) {
  const { rows } = await query(
    `SELECT id, email, full_name AS "fullName", role, is_email_verified AS "isEmailVerified",
            created_at AS "createdAt"
     FROM users WHERE tenant_id = $1 ORDER BY created_at`,
    [tenantId]);
  return rows;
}

export async function updateUserRole(tenantId, userId, role) {
  const { rows } = await query(
    `UPDATE users SET role = $1 WHERE id = $2 AND tenant_id = $3 RETURNING id, role`,
    [role, userId, tenantId]);
  if (!rows[0]) throw ApiError.notFound('User not found');
  return rows[0];
}

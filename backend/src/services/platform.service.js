import bcrypt from 'bcrypt';
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

export async function listTenants() {
  const { rows } = await query(
    `SELECT id, name, slug, center_lat AS "centerLat", center_lng AS "centerLng",
            is_active AS "isActive", created_at AS "createdAt", updated_at AS "updatedAt"
     FROM tenants ORDER BY name`,
  );
  return rows;
}

export async function createTenant({ name, slug, centerLat, centerLng }) {
  const { rows } = await query(
    `INSERT INTO tenants (name, slug, center_lat, center_lng)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, slug, center_lat AS "centerLat", center_lng AS "centerLng", is_active AS "isActive"`,
    [name, slug, centerLat ?? null, centerLng ?? null],
  );
  return rows[0];
}

export async function updateTenant(id, body) {
  const sets = [];
  const params = [];
  const add = (column, value) => { params.push(value); sets.push(`${column} = $${params.length}`); };
  if (body.name !== undefined) add('name', body.name);
  if (body.centerLat !== undefined) add('center_lat', body.centerLat);
  if (body.centerLng !== undefined) add('center_lng', body.centerLng);
  if (body.isActive !== undefined) add('is_active', body.isActive);
  if (!sets.length) throw ApiError.badRequest('No tenant fields to update');
  params.push(id);
  const { rows } = await query(
    `UPDATE tenants SET ${sets.join(', ')} WHERE id = $${params.length}
     RETURNING id, name, slug, center_lat AS "centerLat", center_lng AS "centerLng", is_active AS "isActive"`,
    params,
  );
  if (!rows[0]) throw ApiError.notFound('Tenant not found');
  return rows[0];
}

export async function listReports({ tenantId, page = 1, limit = 50 } = {}) {
  const where = [];
  const params = [];
  if (tenantId) { params.push(tenantId); where.push(`r.tenant_id = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const { rows: countRows } = await query(`SELECT count(*)::int AS total FROM reports r ${whereSql}`, params);
  const { rows } = await query(
    `SELECT r.id, r.title, r.status, r.priority, r.created_at AS "createdAt",
            t.id AS "tenantId", t.name AS "tenantName", t.slug AS "tenantSlug"
     FROM reports r JOIN tenants t ON t.id = r.tenant_id
     ${whereSql}
     ORDER BY r.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return { items: rows, total: countRows[0].total, page, limit };
}

export async function listWorkOrders({ tenantId, page = 1, limit = 50 } = {}) {
  const where = [];
  const params = [];
  if (tenantId) { params.push(tenantId); where.push(`wo.tenant_id = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const { rows: countRows } = await query(`SELECT count(*)::int AS total FROM work_orders wo ${whereSql}`, params);
  const { rows } = await query(
    `SELECT wo.id, wo.title, wo.status, wo.created_at AS "createdAt",
            r.id AS "reportId", r.title AS "reportTitle",
            t.id AS "tenantId", t.name AS "tenantName", t.slug AS "tenantSlug"
     FROM work_orders wo
     JOIN reports r ON r.id = wo.report_id
     JOIN tenants t ON t.id = wo.tenant_id
     ${whereSql}
     ORDER BY wo.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    params,
  );
  return { items: rows, total: countRows[0].total, page, limit };
}

export async function listEntities({ tenantId } = {}) {
  const where = [];
  const params = [];
  if (tenantId) { params.push(tenantId); where.push(`e.tenant_id = $${params.length}`); }
  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const { rows } = await query(
    `SELECT e.id, e.name, e.type, e.email, e.phone, e.notes, e.is_active AS "isActive",
            t.id AS "tenantId", t.name AS "tenantName", t.slug AS "tenantSlug"
     FROM responsible_entities e JOIN tenants t ON t.id = e.tenant_id
     ${whereSql}
     ORDER BY t.name, e.name`,
    params,
  );
  return rows;
}

export async function listTenantAdmins(tenantId) {
  const params = [];
  const where = [`u.role = 'tenant_admin'`];
  if (tenantId) { params.push(tenantId); where.push(`u.tenant_id = $${params.length}`); }
  const { rows } = await query(
    `SELECT u.id, u.email, u.full_name AS "fullName", u.is_email_verified AS "isEmailVerified",
            t.id AS "tenantId", t.name AS "tenantName", t.slug AS "tenantSlug", u.created_at AS "createdAt"
     FROM users u JOIN tenants t ON t.id = u.tenant_id
     WHERE ${where.join(' AND ')} ORDER BY t.name, u.email`,
    params,
  );
  return rows;
}

export async function createTenantAdmin({ tenantId, email, password, fullName }) {
  const hash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    `INSERT INTO users (tenant_id, email, password_hash, full_name, role, is_email_verified)
     VALUES ($1, $2, $3, $4, 'tenant_admin', TRUE)
     RETURNING id, email, full_name AS "fullName", role, tenant_id AS "tenantId"`,
    [tenantId, email.toLowerCase(), hash, fullName],
  );
  return rows[0];
}

import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

export async function listEntities(tenantId) {
  const { rows } = await query(
    `SELECT id, name, type, email, phone, is_active AS "isActive"
     FROM responsible_entities WHERE tenant_id = $1 ORDER BY name`,
    [tenantId]);
  return rows;
}

export async function createEntity(tenantId, { name, type = 'company', email, phone }) {
  const { rows } = await query(
    `INSERT INTO responsible_entities (tenant_id, name, type, email, phone)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, type, email, phone, is_active AS "isActive"`,
    [tenantId, name, type, email ?? null, phone ?? null]);
  return rows[0];
}

export async function updateEntity(tenantId, id, fields) {
  const sets = [];
  const params = [];
  for (const col of ['name', 'type', 'email', 'phone', 'is_active']) {
    const key = col === 'is_active' ? 'isActive' : col;
    if (fields[key] !== undefined) { params.push(fields[key]); sets.push(`${col} = $${params.length}`); }
  }
  if (!sets.length) throw ApiError.badRequest('No fields to update');
  params.push(id, tenantId);
  const { rows } = await query(
    `UPDATE responsible_entities SET ${sets.join(', ')}
     WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
     RETURNING id, name, type, email, phone, is_active AS "isActive"`,
    params);
  if (!rows[0]) throw ApiError.notFound('Entity not found');
  return rows[0];
}

// Set (or change) the default responsible entity a category routes to.
export async function setCategoryRoute(tenantId, categoryId, entityId) {
  const { rows: cat } = await query(
    'SELECT id FROM categories WHERE id = $1 AND tenant_id = $2', [categoryId, tenantId]);
  if (!cat[0]) throw ApiError.notFound('Category not found');
  const { rows: ent } = await query(
    'SELECT id FROM responsible_entities WHERE id = $1 AND tenant_id = $2', [entityId, tenantId]);
  if (!ent[0]) throw ApiError.badRequest('Unknown responsible entity for this tenant');

  const { rows } = await query(
    `INSERT INTO category_routes (category_id, responsible_entity_id)
     VALUES ($1, $2)
     ON CONFLICT (category_id) DO UPDATE SET responsible_entity_id = EXCLUDED.responsible_entity_id
     RETURNING category_id AS "categoryId", responsible_entity_id AS "responsibleEntityId"`,
    [categoryId, entityId]);
  return rows[0];
}

export async function listRoutes(tenantId) {
  const { rows } = await query(
    `SELECT cr.category_id AS "categoryId", c.name AS "categoryName",
            cr.responsible_entity_id AS "responsibleEntityId", e.name AS "responsibleEntityName"
     FROM category_routes cr
     JOIN categories c ON c.id = cr.category_id
     JOIN responsible_entities e ON e.id = cr.responsible_entity_id
     WHERE c.tenant_id = $1 ORDER BY c.sort_order`,
    [tenantId]);
  return rows;
}

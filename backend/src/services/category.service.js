import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

function slugify(s) {
  return s.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export async function createCategory(tenantId, { name, slug, icon, sortOrder = 0 }) {
  const { rows } = await query(
    `INSERT INTO categories (tenant_id, name, slug, icon, sort_order)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, slug, icon, sort_order AS "sortOrder", is_active AS "isActive"`,
    [tenantId, name, slug || slugify(name), icon ?? null, sortOrder]);
  return rows[0];
}

export async function updateCategory(tenantId, id, fields) {
  const sets = [];
  const params = [];
  const map = { name: 'name', slug: 'slug', icon: 'icon', sortOrder: 'sort_order', isActive: 'is_active' };
  for (const [key, col] of Object.entries(map)) {
    if (fields[key] !== undefined) { params.push(fields[key]); sets.push(`${col} = $${params.length}`); }
  }
  if (!sets.length) throw ApiError.badRequest('No fields to update');
  params.push(id, tenantId);
  const { rows } = await query(
    `UPDATE categories SET ${sets.join(', ')}
     WHERE id = $${params.length - 1} AND tenant_id = $${params.length}
     RETURNING id, name, slug, icon, sort_order AS "sortOrder", is_active AS "isActive"`,
    params);
  if (!rows[0]) throw ApiError.notFound('Category not found');
  return rows[0];
}

// Soft delete: deactivate so existing reports keep their category reference.
export async function deactivateCategory(tenantId, id) {
  const { rows } = await query(
    `UPDATE categories SET is_active = FALSE WHERE id = $1 AND tenant_id = $2 RETURNING id`,
    [id, tenantId]);
  if (!rows[0]) throw ApiError.notFound('Category not found');
  return { id: rows[0].id, isActive: false };
}

async function assertCategoryInTenant(tenantId, categoryId) {
  const { rows } = await query('SELECT id FROM categories WHERE id = $1 AND tenant_id = $2',
    [categoryId, tenantId]);
  if (!rows[0]) throw ApiError.notFound('Category not found');
}

export async function createSubcategory(tenantId, categoryId, { name, slug, sortOrder = 0 }) {
  await assertCategoryInTenant(tenantId, categoryId);
  const { rows } = await query(
    `INSERT INTO subcategories (category_id, name, slug, sort_order)
     VALUES ($1, $2, $3, $4)
     RETURNING id, name, slug, sort_order AS "sortOrder", is_active AS "isActive"`,
    [categoryId, name, slug || slugify(name), sortOrder]);
  return rows[0];
}

export async function deactivateSubcategory(tenantId, id) {
  // Join guards tenant ownership of the parent category.
  const { rows } = await query(
    `UPDATE subcategories s SET is_active = FALSE
     FROM categories c
     WHERE s.id = $1 AND s.category_id = c.id AND c.tenant_id = $2
     RETURNING s.id`,
    [id, tenantId]);
  if (!rows[0]) throw ApiError.notFound('Subcategory not found');
  return { id: rows[0].id, isActive: false };
}

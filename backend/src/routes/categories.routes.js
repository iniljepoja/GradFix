import { Router } from 'express';
import { query } from '../config/db.js';

export const router = Router();

// GET /api/v1/categories — active categories for the resolved tenant.
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, name, slug, icon, sort_order AS "sortOrder"
       FROM categories WHERE tenant_id = $1 AND is_active = TRUE
       ORDER BY sort_order, name`,
      [req.tenant.id],
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// GET /api/v1/categories/:id/subcategories
router.get('/:id/subcategories', async (req, res, next) => {
  try {
    // Join guards tenant ownership of the parent category.
    const { rows } = await query(
      `SELECT s.id, s.name, s.slug, s.sort_order AS "sortOrder"
       FROM subcategories s
       JOIN categories c ON c.id = s.category_id
       WHERE s.category_id = $1 AND c.tenant_id = $2 AND s.is_active = TRUE
       ORDER BY s.sort_order, s.name`,
      [req.params.id, req.tenant.id],
    );
    res.json({ data: rows });
  } catch (err) { next(err); }
});

// Admin category/subcategory CRUD lives in the admin router (/api/v1/admin/categories).

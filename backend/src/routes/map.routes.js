import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { query } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';

export const router = Router();

// GET /api/v1/map/reports?bbox=minLng,minLat,maxLng,maxLat — GeoJSON FeatureCollection.
router.get('/reports',
  validate({
    query: z.object({
      bbox: z.string(),
      status: z.string().optional(),
      categoryId: z.string().uuid().optional(),
      limit: z.coerce.number().int().min(1).max(2000).default(500),
    }),
  }),
  async (req, res, next) => {
    try {
      const parts = req.query.bbox.split(',').map(Number);
      if (parts.length !== 4 || parts.some(Number.isNaN)) {
        throw ApiError.badRequest('bbox must be minLng,minLat,maxLng,maxLat');
      }
      const [minLng, minLat, maxLng, maxLat] = parts;

      const where = ['tenant_id = $1', 'longitude BETWEEN $2 AND $3', 'latitude BETWEEN $4 AND $5'];
      const params = [req.tenant.id, minLng, maxLng, minLat, maxLat];
      if (req.query.status) { params.push(req.query.status); where.push(`status = $${params.length}`); }
      if (req.query.categoryId) { params.push(req.query.categoryId); where.push(`category_id = $${params.length}`); }

      const { rows } = await query(
        `SELECT r.id, r.title, r.status, r.upvote_count, r.latitude, r.longitude, c.slug AS category_slug
         FROM reports r JOIN categories c ON c.id = r.category_id
         WHERE ${where.join(' AND ')}
         ORDER BY r.created_at DESC
         LIMIT ${req.query.limit}`,
        params,
      );

      res.json({
        type: 'FeatureCollection',
        features: rows.map((r) => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [r.longitude, r.latitude] },
          properties: {
            id: r.id, title: r.title, status: r.status,
            categorySlug: r.category_slug, upvoteCount: r.upvote_count,
          },
        })),
      });
    } catch (err) { next(err); }
  });

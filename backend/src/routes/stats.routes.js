import { Router } from 'express';
import { publicStats } from '../services/stats.service.js';

export const router = Router();

// GET /api/v1/stats — public dashboard statistics (no auth, tenant-scoped).
router.get('/', async (req, res, next) => {
  try { res.json({ data: await publicStats(req.tenant.id) }); }
  catch (err) { next(err); }
});

import { Router } from 'express';
import { router as authRouter } from './auth.routes.js';
import { router as categoriesRouter } from './categories.routes.js';
import { router as reportsRouter } from './reports.routes.js';
import { router as mapRouter } from './map.routes.js';
import { router as notificationsRouter } from './notifications.routes.js';

export const router = Router();

router.use('/auth', authRouter);
router.use('/categories', categoriesRouter);
router.use('/reports', reportsRouter);
router.use('/map', mapRouter);
router.use('/notifications', notificationsRouter);

// /admin router wired in P2 (admin core API).

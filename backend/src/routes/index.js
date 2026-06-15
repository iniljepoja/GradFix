import { Router } from 'express';
import { router as authRouter } from './auth.routes.js';
import { router as categoriesRouter } from './categories.routes.js';
import { router as reportsRouter } from './reports.routes.js';
import { router as mapRouter } from './map.routes.js';
import { router as notificationsRouter } from './notifications.routes.js';
import { router as adminRouter } from './admin.routes.js';
import { router as statsRouter } from './stats.routes.js';

export const router = Router();

router.use('/auth', authRouter);
router.use('/categories', categoriesRouter);
router.use('/reports', reportsRouter);
router.use('/map', mapRouter);
router.use('/stats', statsRouter);
router.use('/notifications', notificationsRouter);
router.use('/admin', adminRouter);

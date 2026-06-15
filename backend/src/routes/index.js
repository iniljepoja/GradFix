import { Router } from 'express';
import { router as authRouter } from './auth.routes.js';
import { router as categoriesRouter } from './categories.routes.js';
import { router as reportsRouter } from './reports.routes.js';
import { router as mapRouter } from './map.routes.js';

export const router = Router();

router.use('/auth', authRouter);
router.use('/categories', categoriesRouter);
router.use('/reports', reportsRouter);
router.use('/map', mapRouter);

// TODO (week 6): router.use('/admin', adminRouter);

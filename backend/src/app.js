import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { env } from './config/env.js';
import { resolveTenant } from './middleware/tenant.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { router as apiRouter } from './routes/index.js';

export function createApp() {
  const app = express();

  app.use(helmet());
  // In dev/preview the frontend origin port varies (5173 dev, 5174/4173 preview); accept any
  // localhost origin there. Production sets CORS_ORIGINS explicitly and bypasses the local check.
  const isLocalOrigin = (origin) => typeof origin === 'string' && /^http:\/\/localhost(:\d+)?$/.test(origin);
  const corsOrigin = (origin, cb) => {
    if (!origin || env.corsOrigins.includes(origin) || isLocalOrigin(origin)) return cb(null, true);
    return cb(new Error(`Origin ${origin} not allowed by CORS`));
  };
  app.use(cors({ origin: corsOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Serve locally-stored photo uploads.
  app.use('/uploads', express.static(env.uploadDir));

  app.get('/health', (req, res) => res.json({ data: { status: 'ok' } }));

  const limiter = rateLimit({ windowMs: 60_000, max: 120 });
  app.use('/api', limiter);

  // Tenant resolution applies to all versioned API routes.
  app.use('/api/v1', resolveTenant, apiRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

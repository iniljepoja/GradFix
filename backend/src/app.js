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
  app.use(cors({ origin: env.corsOrigins, credentials: true }));
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

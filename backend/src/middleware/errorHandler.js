import { ApiError } from '../utils/ApiError.js';
import { env } from '../config/env.js';

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, req, res, next) {
  if (err instanceof ApiError) {
    return res.status(err.status).json({
      error: { code: err.code, message: err.message, details: err.details },
    });
  }

  // Postgres unique-violation → 409
  if (err.code === '23505') {
    return res.status(409).json({ error: { code: 'CONFLICT', message: 'Resource already exists' } });
  }

  console.error('Unhandled error:', err);
  return res.status(500).json({
    error: {
      code: 'INTERNAL',
      message: env.nodeEnv === 'production' ? 'Internal server error' : err.message,
    },
  });
}

export function notFoundHandler(req, res) {
  res.status(404).json({ error: { code: 'NOT_FOUND', message: `No route for ${req.method} ${req.path}` } });
}

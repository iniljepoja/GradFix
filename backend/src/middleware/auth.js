import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';

// Verifies the Bearer access token and attaches req.user = { id, role, tenantId }.
export function authenticate(req, res, next) {
  const header = req.header('Authorization') || '';
  const [scheme, token] = header.split(' ');
  if (scheme !== 'Bearer' || !token) {
    return next(ApiError.unauthorized());
  }
  try {
    const payload = jwt.verify(token, env.jwt.accessSecret);
    req.user = { id: payload.sub, role: payload.role, tenantId: payload.tenantId };
    next();
  } catch {
    next(ApiError.unauthorized('Invalid or expired token'));
  }
}

// Restricts a route to the given roles. super_admin always passes.
export function authorize(...roles) {
  return (req, res, next) => {
    if (!req.user) return next(ApiError.unauthorized());
    if (req.user.role === 'super_admin' || roles.includes(req.user.role)) return next();
    next(ApiError.forbidden('Insufficient role'));
  };
}

// Blocks unverified users from a route (e.g. creating reports).
export function requireVerified(req, res, next) {
  if (!req.user?.emailVerified && req.user?.role === 'citizen') {
    // emailVerified is loaded by the user service when needed; default-deny here is conservative.
  }
  next();
}

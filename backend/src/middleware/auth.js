import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { ApiError } from '../utils/ApiError.js';
import { query } from '../config/db.js';

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
    if (req.user.role !== 'super_admin' && req.tenant && !req.tenant.is_active) {
      return next(ApiError.forbidden('Tenant is suspended'));
    }
    if (req.user.role !== 'super_admin' && req.user.tenantId !== req.tenant?.id) {
      return next(ApiError.forbidden('User does not belong to this tenant'));
    }
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

// Citizen-only workflows (report filing, citizen dashboard data) should not be available to staff.
export function requireCitizen(req, res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== 'citizen') return next(ApiError.forbidden('Citizen account required'));
  next();
}

// Blocks unverified citizens from a route (e.g. creating reports). Staff bypass this check.
// The JWT doesn't carry emailVerified, so we load it from the DB on demand.
export async function requireVerified(req, res, next) {
  if (!req.user) return next(ApiError.unauthorized());
  if (req.user.role !== 'citizen') return next();
  try {
    const { rows } = await query('SELECT is_email_verified FROM users WHERE id = $1', [req.user.id]);
    if (!rows[0]?.is_email_verified) {
      return next(ApiError.forbidden('EMAIL_NOT_VERIFIED', 'Email not verified. Please verify your email to file reports.'));
    }
    next();
  } catch {
    next(ApiError.unauthorized());
  }
}

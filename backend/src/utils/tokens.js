import crypto from 'node:crypto';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

/** Generate a random opaque token (returned to the user) and its SHA-256 hash (stored). */
export function generateOpaqueToken() {
  const token = crypto.randomBytes(32).toString('hex');
  return { token, hash: hashToken(token) };
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function signAccessToken(user) {
  return jwt.sign(
    { role: user.role, tenantId: user.tenant_id },
    env.jwt.accessSecret,
    { subject: user.id, expiresIn: env.jwt.accessTtl },
  );
}

export function refreshExpiry() {
  const d = new Date();
  d.setDate(d.getDate() + env.jwt.refreshTtlDays);
  return d;
}

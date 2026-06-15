import bcrypt from 'bcrypt';
import { query, withTransaction } from '../config/db.js';
import { ApiError } from '../utils/ApiError.js';
import { sendMail } from '../utils/mailer.js';
import { env } from '../config/env.js';
import {
  generateOpaqueToken, hashToken, signAccessToken, refreshExpiry,
} from '../utils/tokens.js';
import { badgeForCount } from '../utils/badges.js';
import { reporterReportCount } from './report.service.js';

const VERIFY_TTL_HOURS = 24;
const RESET_TTL_HOURS = 1;

export async function register(tenant, { email, password, fullName }) {
  const passwordHash = await bcrypt.hash(password, 12);
  const { rows } = await query(
    `INSERT INTO users (tenant_id, email, password_hash, full_name)
     VALUES ($1, $2, $3, $4)
     RETURNING id, email, full_name, role, is_email_verified`,
    [tenant.id, email.toLowerCase(), passwordHash, fullName],
  );
  const user = rows[0];
  await issueVerificationEmail(user.id, user.email);
  return user;
}

async function issueVerificationEmail(userId, email) {
  const { token, hash } = generateOpaqueToken();
  const expires = new Date(Date.now() + VERIFY_TTL_HOURS * 3600_000);
  await query(
    `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hash, expires],
  );
  const link = `${env.appBaseUrl}/verify-email?token=${token}`;
  await sendMail({
    to: email,
    subject: 'Verify your GradFix email',
    text: `Confirm your email: ${link}`,
    html: `<p>Confirm your email: <a href="${link}">${link}</a></p>`,
  });
}

export async function verifyEmail(token) {
  const hash = hashToken(token);
  const { rows } = await query(
    `SELECT id, user_id FROM email_verification_tokens
     WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()`,
    [hash],
  );
  const row = rows[0];
  if (!row) throw ApiError.badRequest('Invalid or expired verification token');
  await withTransaction(async (c) => {
    await c.query('UPDATE email_verification_tokens SET consumed_at = now() WHERE id = $1', [row.id]);
    await c.query('UPDATE users SET is_email_verified = TRUE WHERE id = $1', [row.user_id]);
  });
}

export async function login(tenant, { email, password }) {
  const { rows } = await query(
    `SELECT id, email, password_hash, full_name, role, is_email_verified, tenant_id
     FROM users WHERE tenant_id = $1 AND email = $2`,
    [tenant.id, email.toLowerCase()],
  );
  const user = rows[0];
  if (!user || !(await bcrypt.compare(password, user.password_hash))) {
    throw ApiError.unauthorized('Invalid credentials');
  }
  const accessToken = signAccessToken(user);
  const refreshToken = await issueRefreshToken(user.id);
  return {
    accessToken,
    refreshToken,
    user: {
      id: user.id, email: user.email, fullName: user.full_name,
      role: user.role, isEmailVerified: user.is_email_verified,
    },
  };
}

async function issueRefreshToken(userId) {
  const { token, hash } = generateOpaqueToken();
  await query(
    `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hash, refreshExpiry()],
  );
  return token;
}

export async function refresh(rawToken) {
  const hash = hashToken(rawToken);
  const { rows } = await query(
    `SELECT rt.id, rt.user_id, u.role, u.tenant_id
     FROM refresh_tokens rt JOIN users u ON u.id = rt.user_id
     WHERE rt.token_hash = $1 AND rt.revoked_at IS NULL AND rt.expires_at > now()`,
    [hash],
  );
  const row = rows[0];
  if (!row) throw ApiError.unauthorized('Invalid refresh token');
  // Rotate: revoke the old token, issue a new one.
  const newToken = await withTransaction(async (c) => {
    await c.query('UPDATE refresh_tokens SET revoked_at = now() WHERE id = $1', [row.id]);
    const fresh = generateOpaqueToken();
    await c.query(
      `INSERT INTO refresh_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
      [row.user_id, fresh.hash, refreshExpiry()],
    );
    return fresh.token;
  });
  const accessToken = signAccessToken({ id: row.user_id, role: row.role, tenant_id: row.tenant_id });
  return { accessToken, refreshToken: newToken };
}

export async function logout(rawToken) {
  if (!rawToken) return;
  await query('UPDATE refresh_tokens SET revoked_at = now() WHERE token_hash = $1', [hashToken(rawToken)]);
}

export async function requestPasswordReset(tenant, email) {
  const { rows } = await query('SELECT id FROM users WHERE tenant_id = $1 AND email = $2',
    [tenant.id, email.toLowerCase()]);
  const user = rows[0];
  if (!user) return; // do not reveal whether the email exists
  const { token, hash } = generateOpaqueToken();
  const expires = new Date(Date.now() + RESET_TTL_HOURS * 3600_000);
  await query('INSERT INTO password_reset_tokens (user_id, token_hash, expires_at) VALUES ($1, $2, $3)',
    [user.id, hash, expires]);
  const link = `${env.appBaseUrl}/reset-password?token=${token}`;
  await sendMail({ to: email, subject: 'Reset your GradFix password', text: `Reset: ${link}` });
}

export async function resetPassword(token, newPassword) {
  const hash = hashToken(token);
  const { rows } = await query(
    `SELECT id, user_id FROM password_reset_tokens
     WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > now()`,
    [hash],
  );
  const row = rows[0];
  if (!row) throw ApiError.badRequest('Invalid or expired reset token');
  const passwordHash = await bcrypt.hash(newPassword, 12);
  await withTransaction(async (c) => {
    await c.query('UPDATE password_reset_tokens SET consumed_at = now() WHERE id = $1', [row.id]);
    await c.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, row.user_id]);
    await c.query('UPDATE refresh_tokens SET revoked_at = now() WHERE user_id = $1 AND revoked_at IS NULL',
      [row.user_id]);
  });
}

export async function getProfile(userId) {
  const { rows } = await query(
    `SELECT id, email, full_name, role, is_email_verified FROM users WHERE id = $1`,
    [userId],
  );
  if (!rows[0]) throw ApiError.notFound('User not found');
  const u = rows[0];
  const count = await reporterReportCount(userId);
  return {
    id: u.id, email: u.email, fullName: u.full_name, role: u.role,
    isEmailVerified: u.is_email_verified, ...badgeForCount(count),
  };
}

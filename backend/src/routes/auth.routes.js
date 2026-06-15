import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import * as auth from '../services/auth.service.js';

export const router = Router();

const registerSchema = {
  body: z.object({
    email: z.string().email(),
    password: z.string().min(8),
    fullName: z.string().min(1),
  }),
};

router.post('/register', validate(registerSchema), async (req, res, next) => {
  try {
    const user = await auth.register(req.tenant, req.body);
    res.status(201).json({ data: { id: user.id, email: user.email, isEmailVerified: user.is_email_verified } });
  } catch (err) { next(err); }
});

router.post('/login',
  validate({ body: z.object({ email: z.string().email(), password: z.string() }) }),
  async (req, res, next) => {
    try { res.json({ data: await auth.login(req.tenant, req.body) }); }
    catch (err) { next(err); }
  });

router.post('/refresh',
  validate({ body: z.object({ refreshToken: z.string() }) }),
  async (req, res, next) => {
    try { res.json({ data: await auth.refresh(req.body.refreshToken) }); }
    catch (err) { next(err); }
  });

router.post('/logout', authenticate,
  validate({ body: z.object({ refreshToken: z.string().optional() }) }),
  async (req, res, next) => {
    try { await auth.logout(req.body.refreshToken); res.json({ data: { ok: true } }); }
    catch (err) { next(err); }
  });

router.post('/verify-email',
  validate({ body: z.object({ token: z.string() }) }),
  async (req, res, next) => {
    try { await auth.verifyEmail(req.body.token); res.json({ data: { verified: true } }); }
    catch (err) { next(err); }
  });

router.post('/forgot-password',
  validate({ body: z.object({ email: z.string().email() }) }),
  async (req, res, next) => {
    try { await auth.requestPasswordReset(req.tenant, req.body.email); res.json({ data: { ok: true } }); }
    catch (err) { next(err); }
  });

router.post('/reset-password',
  validate({ body: z.object({ token: z.string(), password: z.string().min(8) }) }),
  async (req, res, next) => {
    try { await auth.resetPassword(req.body.token, req.body.password); res.json({ data: { ok: true } }); }
    catch (err) { next(err); }
  });

router.get('/me', authenticate, async (req, res, next) => {
  try { res.json({ data: await auth.getProfile(req.user.id) }); }
  catch (err) { next(err); }
});

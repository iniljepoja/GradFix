import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { env } from '../config/env.js';
import { savePushSubscription, removePushSubscription } from '../services/notification.service.js';

export const router = Router();

// GET /api/v1/notifications/vapid-public — public VAPID key for the browser push subscription.
router.get('/vapid-public', (req, res) => {
  res.json({ data: { publicKey: env.vapid.publicKey } });
});

// POST /api/v1/notifications/push — store a Web Push subscription for the current user.
router.post('/push', authenticate,
  validate({
    body: z.object({
      endpoint: z.string().url(),
      keys: z.object({ p256dh: z.string(), auth: z.string() }),
    }),
  }),
  async (req, res, next) => {
    try {
      await savePushSubscription(req.user.id, req.body);
      res.status(201).json({ data: { ok: true } });
    } catch (err) { next(err); }
  });

// DELETE /api/v1/notifications/push — remove the user's push subscription for this endpoint.
router.delete('/push', authenticate,
  validate({ body: z.object({ endpoint: z.string().url() }) }),
  async (req, res, next) => {
    try {
      await removePushSubscription(req.user.id, req.body.endpoint);
      res.json({ data: { ok: true } });
    } catch (err) { next(err); }
  });

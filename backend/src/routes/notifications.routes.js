import { Router } from 'express';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { savePushSubscription } from '../services/notification.service.js';

export const router = Router();

// POST /api/v1/notifications/push — store a Web Push subscription for the current user.
// Email notifications are sent today; push delivery is wired once VAPID keys are provisioned.
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

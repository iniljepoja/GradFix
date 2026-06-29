import webpush from 'web-push';
import { query } from '../config/db.js';
import { env } from '../config/env.js';
import { sendMail } from '../utils/mailer.js';

webpush.setVapidDetails(env.vapid.subject, env.vapid.publicKey, env.vapid.privateKey);

const STATUS_LABELS = {
  new: 'New', accepted: 'Accepted', assigned: 'Assigned',
  in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed',
};

// Notify the reporter that their report changed status. Email + Web Push are best-effort:
// a delivery failure never rolls back the status change (called after commit).
export async function notifyStatusChange({ reportId, title, toStatus }) {
  const { rows } = await query(
    `SELECT u.id, u.email FROM reports r JOIN users u ON u.id = r.reporter_id WHERE r.id = $1`,
    [reportId],
  );
  const user = rows[0];
  if (!user) return; // anonymous report or deleted user

  const label = STATUS_LABELS[toStatus] ?? toStatus;

  await sendMail({
    to: user.email,
    subject: `GradFix: your report is now "${label}"`,
    text: `Your report "${title}" has been updated to: ${label}.`,
    html: `<p>Your report "<strong>${title}</strong>" has been updated to: <strong>${label}</strong>.</p>`,
  }).catch((err) => console.error('Status email failed:', err.message));

  await sendPushToUser(user.id, {
    title: `Report: ${label}`,
    body: `"${title}" is now ${label.toLowerCase()}.`,
    url: `/reports/${reportId}`,
  }).catch((err) => console.error('Status push failed:', err.message));
}

// Fan out a Web Push notification to every subscription owned by the user.
// Subscriptions that are gone (404/410) are pruned silently.
export async function sendPushToUser(userId, payload) {
  const { rows } = await query(
    'SELECT id, endpoint, p256dh, auth FROM push_subscriptions WHERE user_id = $1',
    [userId],
  );
  if (rows.length === 0) return;
  const body = JSON.stringify(payload);
  await Promise.all(rows.map((sub) => deliver(sub, body)));
}

async function deliver(sub, body) {
  try {
    await webpush.sendNotification(
      { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
      body,
    );
  } catch (err) {
    if (err.statusCode === 404 || err.statusCode === 410) {
      await query('DELETE FROM push_subscriptions WHERE id = $1', [sub.id]);
    } else {
      throw err;
    }
  }
}

export async function savePushSubscription(userId, { endpoint, keys }) {
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [userId, endpoint, keys.p256dh, keys.auth],
  );
}

export async function removePushSubscription(userId, endpoint) {
  await query(
    'DELETE FROM push_subscriptions WHERE user_id = $1 AND endpoint = $2',
    [userId, endpoint],
  );
}

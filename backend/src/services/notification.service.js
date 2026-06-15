import { query } from '../config/db.js';
import { sendMail } from '../utils/mailer.js';

const STATUS_LABELS = {
  new: 'New', accepted: 'Accepted', assigned: 'Assigned',
  in_progress: 'In progress', resolved: 'Resolved', closed: 'Closed',
};

// Notify the reporter that their report changed status. Email runs now; Web Push is deferred
// (subscriptions are stored, delivery is a TODO once VAPID keys are provisioned).
export async function notifyStatusChange({ reportId, title, toStatus }) {
  const { rows } = await query(
    `SELECT u.email FROM reports r JOIN users u ON u.id = r.reporter_id WHERE r.id = $1`,
    [reportId],
  );
  const email = rows[0]?.email;
  if (!email) return; // anonymous report or deleted user

  const label = STATUS_LABELS[toStatus] ?? toStatus;
  await sendMail({
    to: email,
    subject: `GradFix: your report is now "${label}"`,
    text: `Your report "${title}" has been updated to: ${label}.`,
    html: `<p>Your report "<strong>${title}</strong>" has been updated to: <strong>${label}</strong>.</p>`,
  });
  // TODO: fan out to push_subscriptions for this user once Web Push delivery is wired.
}

export async function savePushSubscription(userId, { endpoint, keys }) {
  await query(
    `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, endpoint) DO UPDATE SET p256dh = EXCLUDED.p256dh, auth = EXCLUDED.auth`,
    [userId, endpoint, keys.p256dh, keys.auth],
  );
}

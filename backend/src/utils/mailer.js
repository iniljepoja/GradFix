import nodemailer from 'nodemailer';
import { env } from '../config/env.js';

// In dev without SMTP configured, emails are logged to the console.
let transporter = null;
if (env.mail.host) {
  transporter = nodemailer.createTransport({
    host: env.mail.host,
    port: env.mail.port,
    auth: env.mail.user ? { user: env.mail.user, pass: env.mail.pass } : undefined,
  });
}

export async function sendMail({ to, subject, html, text, attachments }) {
  if (!transporter) {
    console.log(`\n[mailer] To: ${to}\n[mailer] Subject: ${subject}\n[mailer] ${text || html}` +
      (attachments?.length ? `\n[mailer] Attachments: ${attachments.map((a) => a.filename).join(', ')}` : '') + '\n');
    return;
  }
  await transporter.sendMail({ from: env.mail.from, to, subject, html, text, attachments });
}

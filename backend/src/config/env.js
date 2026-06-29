import dotenv from 'dotenv';

dotenv.config();

export const env = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  corsOrigins: (process.env.CORS_ORIGINS || 'http://localhost:5173').split(','),
  databaseUrl: process.env.DATABASE_URL || 'postgres://gradfix:gradfix@localhost:5432/gradfix',
  jwt: {
    accessSecret: process.env.JWT_ACCESS_SECRET || 'dev-access-secret',
    refreshSecret: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
    accessTtl: process.env.ACCESS_TOKEN_TTL || '15m',
    refreshTtlDays: Number(process.env.REFRESH_TOKEN_TTL_DAYS || 30),
  },
  mail: {
    host: process.env.SMTP_HOST || '',
    port: Number(process.env.SMTP_PORT || 587),
    user: process.env.SMTP_USER || '',
    pass: process.env.SMTP_PASS || '',
    from: process.env.MAIL_FROM || 'GradFix <no-reply@gradfix.app>',
  },
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:5173',
  uploadDir: process.env.UPLOAD_DIR || 'uploads',
  vapid: {
    publicKey: process.env.VAPID_PUBLIC_KEY || 'BJU9oILqWf_sXkaZAI3w4KvNVT4Jr4j3zs5BSDSfFwqtfsEcF0PtQefpqu4PCYz0h2nN_NawYWNvKh4mMpnE8iY',
    privateKey: process.env.VAPID_PRIVATE_KEY || 'wpmdbO5X45QrRQhqBCEgTZTcFwxQiwV14GI7e2nkKVI',
    subject: process.env.VAPID_SUBJECT || 'mailto:admin@gradfix.app',
  },
};

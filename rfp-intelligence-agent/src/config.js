const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

function boolEnv(value, fallback = false) {
  if (value === undefined || value === '') return fallback;
  return ['1', 'true', 'yes', 'on'].includes(String(value).toLowerCase());
}

module.exports = {
  rootDir,
  port: Number(process.env.PORT || 4177),
  host: process.env.HOST || '127.0.0.1',
  adminToken: process.env.RFP_ADMIN_TOKEN || 'change-me-local-token',
  cronToken: process.env.RFP_CRON_TOKEN || process.env.RFP_ADMIN_TOKEN || 'change-me-local-token',
  dataDir: process.env.RFP_DATA_DIR || path.join(rootDir, 'data'),
  dbPath: process.env.RFP_DB_PATH || path.join(rootDir, 'data', 'rfp-intelligence.sqlite'),
  userAgent: process.env.RFP_USER_AGENT || 'RFPIntelligenceAgent/0.1 (+private-rfp-research; respectful scraping)',
  emailPipelineEnabled: boolEnv(process.env.RFP_EMAIL_PIPELINE_ENABLED, false),
  emailScheduleDays: Number(process.env.RFP_EMAIL_SCHEDULE_DAYS || 4),
  emailScheduleCheckMinutes: Number(process.env.RFP_EMAIL_SCHEDULE_CHECK_MINUTES || 60),
  emailRecipients: process.env.RFP_EMAIL_RECIPIENTS || 'Vyshakh@vic.org.in,Vyshaak09@gmail.com',
  emailFrom: process.env.RFP_EMAIL_FROM || '',
  smtpHost: process.env.SMTP_HOST || '',
  smtpPort: Number(process.env.SMTP_PORT || 587),
  smtpSecure: boolEnv(process.env.SMTP_SECURE, false),
  smtpUser: process.env.SMTP_USER || '',
  smtpPass: process.env.SMTP_PASS || '',
  smtpTimeoutMs: Number(process.env.SMTP_TIMEOUT_MS || 15000)
};

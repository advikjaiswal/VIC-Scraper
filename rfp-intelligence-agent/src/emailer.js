const dns = require('node:dns').promises;
const nodemailer = require('nodemailer');

function parseRecipients(value) {
  return String(value || '')
    .split(/[,\n;]/)
    .map(item => item.trim())
    .filter(Boolean);
}

function missingEmailConfig(config) {
  const missing = [];
  if (!config.emailFrom) missing.push('RFP_EMAIL_FROM');
  if (!parseRecipients(config.emailRecipients).length) missing.push('RFP_EMAIL_RECIPIENTS');
  if (!config.emailWebhookUrl) {
    if (!config.smtpHost) missing.push('SMTP_HOST');
    if (!config.smtpUser) missing.push('SMTP_USER');
    if (!config.smtpPass) missing.push('SMTP_PASS');
  }
  return missing;
}

async function resolveSmtpHost(config) {
  const host = config.smtpHost;
  if (!host || /^\d+\.\d+\.\d+\.\d+$/.test(host)) return host;

  const addresses = await dns.resolve4(host);
  return addresses[0] || host;
}

function createTransport(config, options = {}) {
  const timeout = Number(config.smtpTimeoutMs || 15000);
  const host = options.host || config.smtpHost;
  return nodemailer.createTransport({
    host,
    port: config.smtpPort,
    family: 4,
    secure: config.smtpSecure,
    connectionTimeout: timeout,
    greetingTimeout: timeout,
    socketTimeout: timeout,
    tls: {
      servername: config.smtpHost
    },
    auth: {
      user: config.smtpUser,
      pass: config.smtpPass
    }
  });
}

async function sendViaWebhook({ config, payload }) {
  const response = await fetch(config.emailWebhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      secret: config.emailWebhookSecret,
      ...payload
    }),
    signal: AbortSignal.timeout(Number(config.smtpTimeoutMs || 15000))
  });

  const text = await response.text();
  if (!response.ok) {
    const error = new Error(`Email webhook failed with ${response.status}: ${text.slice(0, 240)}`);
    error.code = 'EMAIL_WEBHOOK_FAILED';
    throw error;
  }

  return {
    messageId: `webhook-${Date.now()}`,
    provider: 'webhook',
    response: text.slice(0, 240)
  };
}

async function sendLeadsCsvEmail({ config, csv, stats, scanRun, now = new Date(), transport }) {
  const missing = missingEmailConfig(config);
  if (missing.length) {
    const error = new Error(`Email pipeline is not configured. Missing: ${missing.join(', ')}`);
    error.code = 'EMAIL_CONFIG_MISSING';
    throw error;
  }

  const recipients = parseRecipients(config.emailRecipients);
  const date = now.toISOString().slice(0, 10);
  const filename = `rfp-tender-tracker-${date}.csv`;
  const found = scanRun ? `${scanRun.found || 0} found, ${scanRun.saved || 0} saved, ${scanRun.updated || 0} updated` : 'scan skipped';
  const errors = scanRun?.errors?.length ? `\n\nSource warnings:\n${scanRun.errors.map(error => `- ${error.source_name || error.source_id}: ${error.message}`).join('\n')}` : '';

  const payload = {
    from: config.emailFrom,
    to: recipients,
    subject: `RFP tender tracker CSV - ${date}`,
    text: [
      'Attached is the latest RFP tender tracker CSV.',
      '',
      `Total opportunities: ${stats.total || 0}`,
      `New opportunities: ${stats.new_count || 0}`,
      `Shortlisted: ${stats.shortlisted_count || 0}`,
      `Submitted: ${stats.submitted_count || 0}`,
      `Won: ${stats.won_count || 0}`,
      `Success fee tracked: INR ${stats.success_fee_inr || 0}`,
      `Latest scan: ${found}`,
      errors
    ].join('\n'),
    attachments: [{
      filename,
      content: csv,
      contentType: 'text/csv; charset=utf-8'
    }]
  };

  const info = config.emailWebhookUrl && !transport
    ? await sendViaWebhook({ config, payload })
    : await (transport || createTransport(config, { host: await resolveSmtpHost(config) })).sendMail(payload);

  return {
    messageId: info.messageId || '',
    provider: info.provider || 'smtp',
    recipients,
    filename
  };
}

module.exports = {
  parseRecipients,
  missingEmailConfig,
  resolveSmtpHost,
  createTransport,
  sendViaWebhook,
  sendLeadsCsvEmail
};

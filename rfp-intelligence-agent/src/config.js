const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');

module.exports = {
  rootDir,
  port: Number(process.env.PORT || 4177),
  host: process.env.HOST || '127.0.0.1',
  adminToken: process.env.RFP_ADMIN_TOKEN || 'change-me-local-token',
  dataDir: process.env.RFP_DATA_DIR || path.join(rootDir, 'data'),
  dbPath: process.env.RFP_DB_PATH || path.join(rootDir, 'data', 'rfp-intelligence.sqlite'),
  userAgent: process.env.RFP_USER_AGENT || 'RFPIntelligenceAgent/0.1 (+private-rfp-research; respectful scraping)'
};

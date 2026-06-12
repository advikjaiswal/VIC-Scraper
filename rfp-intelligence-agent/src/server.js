const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const config = require('./config');
const { createStore } = require('./storage');
const { seedSources } = require('./sources');
const { SOURCES } = require('./sources');
const { runScan } = require('./scanner');
const { buildActions } = require('./actions');
const { scoreTender } = require('./scoring');
const { normalizeTender } = require('./domain');
const { tendersToCsv } = require('./exporters');
const { generateTemplateProposal } = require('./proposals');
const { slug } = require('./domain');

const publicDir = path.join(config.rootDir, 'public');
const store = createStore(config.dbPath);
store.init();
seedSources(store);

function send(res, status, body, headers = {}) {
  const isText = typeof body === 'string' || Buffer.isBuffer(body);
  res.writeHead(status, {
    'Content-Type': isText ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    ...headers
  });
  res.end(isText ? body : JSON.stringify(body));
}

function authOk(req) {
  if (config.adminToken === 'change-me-local-token' && process.env.NODE_ENV !== 'production') return true;
  const header = req.headers.authorization || '';
  const bearer = header.startsWith('Bearer ') ? header.slice(7) : '';
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get('token') || '';
  return bearer === config.adminToken || token === config.adminToken;
}

function requireAuth(req, res) {
  if (authOk(req)) return true;
  send(res, 401, { error: 'Private RFP tool. Provide RFP_ADMIN_TOKEN.' });
  return false;
}

function refreshStoredIntelligence(now = new Date()) {
  const tenders = store.listTenders({ limit: 5000 });
  let refreshed = 0;

  for (const tender of tenders) {
    store.upsertTender(scoreTender(normalizeTender({
      ...tender,
      ai_summary: '',
      ai_recommendation: '',
      next_action: ''
    }), { now }));
    refreshed += 1;
  }

  const actions = store.replaceActions(buildActions(store.listTenders({ limit: 500 }), { now }));
  return { refreshed, actions };
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  return raw ? JSON.parse(raw) : {};
}

async function api(req, res, url) {
  if (!requireAuth(req, res)) return;

  if (req.method === 'GET' && url.pathname === '/api/state') {
    refreshStoredIntelligence();
    send(res, 200, {
      stats: store.stats(),
      tenders: store.listTenders({
        status: url.searchParams.get('status') || '',
        source_id: url.searchParams.get('source_id') || '',
        fit: url.searchParams.get('fit') || '',
        deadline: url.searchParams.get('deadline') || '',
        q: url.searchParams.get('q') || '',
        limit: 250
      }),
      action_tenders: store.listTenders({ limit: 1000 }),
      drafts: store.listProposalDrafts(),
      actions: store.listActions(),
      sources: store.listSources()
    });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/scan') {
    const run = await runScan({ store, sources: SOURCES });
    const { actions } = refreshStoredIntelligence();
    send(res, 200, { run, actions, stats: store.stats() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/autopilot') {
    const body = await readJson(req);
    const run = body.scan === false ? null : await runScan({ store, sources: SOURCES });
    const { actions } = refreshStoredIntelligence();
    send(res, 200, { run, actions, stats: store.stats() });
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/tenders') {
    const body = await readJson(req);
    const scored = scoreTender(normalizeTender(body));
    send(res, 201, { tender: store.upsertTender(scored) });
    return;
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/tenders\/[^/]+\/status$/)) {
    const id = decodeURIComponent(url.pathname.split('/')[3]);
    const body = await readJson(req);
    send(res, 200, { tender: store.updateTenderStatus(id, body.status) });
    return;
  }

  if (req.method === 'POST' && url.pathname.match(/^\/api\/tenders\/[^/]+\/draft$/)) {
    const id = decodeURIComponent(url.pathname.split('/')[3]);
    const tender = store.getTender(id);
    if (!tender) {
      send(res, 404, { error: 'Tender not found' });
      return;
    }
    const draft = generateTemplateProposal({
      tender,
      clientProfile: {
        organization_name: 'Client Research Team',
        sectors: ['impact evaluation', 'CSR', 'MEL', 'development-sector research']
      }
    });
    const saved = store.saveProposalDraft(draft);
    send(res, 201, { draft: saved });
    return;
  }

  if (req.method === 'GET' && url.pathname.match(/^\/api\/drafts\/[^/]+\/markdown$/)) {
    const id = decodeURIComponent(url.pathname.split('/')[3]);
    const draft = store.getProposalDraft(id);
    if (!draft) {
      send(res, 404, { error: 'Draft not found' });
      return;
    }
    send(res, 200, draft.markdown || '', {
      'Content-Type': 'text/markdown; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug(draft.title || id) || id}.md"`
    });
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/export/tenders.csv') {
    send(res, 200, tendersToCsv(store.listTenders({ limit: 1000 })), {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="rfp-tender-tracker.csv"'
    });
    return;
  }

  send(res, 404, { error: 'Not found' });
}

function serveStatic(req, res, url) {
  const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
  const fullPath = path.join(publicDir, file);
  if (!fullPath.startsWith(publicDir) || !fs.existsSync(fullPath)) {
    send(res, 404, 'Not found');
    return;
  }
  const type = fullPath.endsWith('.html') ? 'text/html; charset=utf-8'
    : fullPath.endsWith('.css') ? 'text/css; charset=utf-8'
      : 'application/javascript; charset=utf-8';
  res.writeHead(200, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  fs.createReadStream(fullPath).pipe(res);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  if (req.method === 'GET' && url.pathname === '/health') {
    send(res, 200, {
      ok: true,
      service: 'rfp-intelligence-agent',
      timestamp: new Date().toISOString()
    });
    return;
  }
  if (url.pathname.startsWith('/api/')) {
    api(req, res, url).catch(error => send(res, 500, { error: error.message }));
    return;
  }
  serveStatic(req, res, url);
});

if (require.main === module) {
  server.listen(config.port, config.host, () => {
    console.log(`RFP Intelligence Agent listening on http://${config.host}:${config.port}`);
  });
}

module.exports = { server, store };

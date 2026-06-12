const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { normalizeTender, canTransitionStatus } = require('./domain');
const { openableSourceUrl, sourceLinkType } = require('./sourceLinks');

function sqlQuote(value) {
  if (value === null || value === undefined) return 'NULL';
  return `'${String(value).replace(/'/g, "''")}'`;
}

function jsonQuote(value) {
  return sqlQuote(JSON.stringify(value || null));
}

function numberValue(value) {
  const n = Number(value || 0);
  return Number.isFinite(n) ? String(n) : '0';
}

function boolInt(value) {
  return value ? '1' : '0';
}

function createStore(dbPath) {
  const resolved = path.resolve(dbPath);

  function run(sql) {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    execFileSync('sqlite3', [resolved, sql], { encoding: 'utf8' });
  }

  function all(sql) {
    fs.mkdirSync(path.dirname(resolved), { recursive: true });
    const output = execFileSync('sqlite3', ['-json', resolved, sql], { encoding: 'utf8' });
    if (!output.trim()) return [];
    return JSON.parse(output);
  }

  function get(sql) {
    return all(sql)[0] || null;
  }

  function init() {
    run(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS sources (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        base_url TEXT,
        region TEXT,
        categories TEXT,
        enabled INTEGER DEFAULT 1,
        parser TEXT,
        notes TEXT,
        last_checked_at TEXT,
        health_status TEXT DEFAULT 'unknown',
        last_error TEXT
      );
      CREATE TABLE IF NOT EXISTS scan_runs (
        id TEXT PRIMARY KEY,
        status TEXT NOT NULL,
        found INTEGER DEFAULT 0,
        saved INTEGER DEFAULT 0,
        updated INTEGER DEFAULT 0,
        skipped INTEGER DEFAULT 0,
        errors TEXT,
        started_at TEXT,
        finished_at TEXT
      );
      CREATE TABLE IF NOT EXISTS tenders (
        id TEXT PRIMARY KEY,
        tracking_id TEXT,
        source_id TEXT,
        source_name TEXT,
        source_url TEXT,
        detail_url TEXT,
        title TEXT NOT NULL,
        organization TEXT,
        country TEXT,
        region TEXT,
        sector TEXT,
        opportunity_type TEXT,
        deadline TEXT,
        posted_date TEXT,
        scraped_at TEXT,
        description_raw TEXT,
        description_clean TEXT,
        documents TEXT,
        contact_email TEXT,
        submission_url TEXT,
        submission_method TEXT,
        budget_text TEXT,
        eligibility_text TEXT,
        keywords_matched TEXT,
        status TEXT DEFAULT 'new',
        duplicate_key TEXT UNIQUE,
        fit_score INTEGER DEFAULT 0,
        urgency_score INTEGER DEFAULT 0,
        eligibility_score INTEGER DEFAULT 0,
        proposal_effort_score INTEGER DEFAULT 0,
        overall_score INTEGER DEFAULT 0,
        ai_summary TEXT,
        ai_recommendation TEXT,
        next_action TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS tender_documents (
        id TEXT PRIMARY KEY,
        tender_id TEXT NOT NULL,
        url TEXT,
        filename TEXT,
        content_type TEXT,
        parsed_text TEXT,
        summary TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS proposal_drafts (
        id TEXT PRIMARY KEY,
        tender_id TEXT NOT NULL,
        title TEXT,
        markdown TEXT,
        cover_email TEXT,
        checklist_markdown TEXT,
        needs_human_input TEXT,
        confidence_score INTEGER DEFAULT 0,
        status TEXT DEFAULT 'draft',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS actions (
        id TEXT PRIMARY KEY,
        tender_id TEXT,
        type TEXT,
        label TEXT,
        status TEXT DEFAULT 'open',
        priority INTEGER DEFAULT 50,
        due_at TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT
      );
      CREATE TABLE IF NOT EXISTS client_profile (
        id TEXT PRIMARY KEY DEFAULT 'default',
        organization_name TEXT,
        sectors TEXT,
        countries TEXT,
        capability_summary TEXT,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE TABLE IF NOT EXISTS audit_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        entity_type TEXT,
        entity_id TEXT,
        action TEXT,
        metadata TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
      CREATE INDEX IF NOT EXISTS idx_tenders_status ON tenders(status);
      CREATE INDEX IF NOT EXISTS idx_tenders_score ON tenders(overall_score DESC);
      CREATE INDEX IF NOT EXISTS idx_tenders_deadline ON tenders(deadline);
    `);
    const actionColumns = all('PRAGMA table_info(actions)').map(column => column.name);
    if (!actionColumns.includes('priority')) run('ALTER TABLE actions ADD COLUMN priority INTEGER DEFAULT 50;');
    const tenderColumns = all('PRAGMA table_info(tenders)').map(column => column.name);
    if (!tenderColumns.includes('tracking_id')) run('ALTER TABLE tenders ADD COLUMN tracking_id TEXT;');
    run('CREATE UNIQUE INDEX IF NOT EXISTS idx_tenders_tracking_id ON tenders(tracking_id);');
    assignMissingTrackingIds();
  }

  function trackingYear(tender = {}) {
    const candidate = tender.deadline || tender.posted_date || tender.scraped_at || new Date().toISOString();
    const match = String(candidate).match(/\b(20\d{2})\b/);
    return match ? match[1] : String(new Date().getFullYear());
  }

  function nextTrackingId(year) {
    const key = `tracking_sequence_${year}`;
    const current = get(`SELECT value FROM settings WHERE key = ${sqlQuote(key)}`);
    const next = Number(current?.value || 0) + 1;
    run(`
      INSERT INTO settings (key, value)
      VALUES (${sqlQuote(key)}, ${sqlQuote(String(next))})
      ON CONFLICT(key) DO UPDATE SET value = excluded.value;
    `);
    return `VIC-RFP-${year}-${String(next).padStart(4, '0')}`;
  }

  function assignMissingTrackingIds() {
    const missing = all('SELECT id, deadline, posted_date, scraped_at FROM tenders WHERE tracking_id IS NULL OR tracking_id = "" ORDER BY created_at ASC, id ASC');
    for (const tender of missing) {
      run(`UPDATE tenders SET tracking_id = ${sqlQuote(nextTrackingId(trackingYear(tender)))} WHERE id = ${sqlQuote(tender.id)};`);
    }
  }

  function upsertSource(source) {
    run(`
      INSERT INTO sources (id, name, type, base_url, region, categories, enabled, parser, notes, health_status)
      VALUES (${sqlQuote(source.id)}, ${sqlQuote(source.name)}, ${sqlQuote(source.type)}, ${sqlQuote(source.base_url)}, ${sqlQuote(source.region)}, ${jsonQuote(source.categories || [])}, ${boolInt(source.enabled !== false)}, ${sqlQuote(source.parser)}, ${sqlQuote(source.notes)}, ${sqlQuote(source.health_status || 'unknown')})
      ON CONFLICT(id) DO UPDATE SET
        name = excluded.name,
        type = excluded.type,
        base_url = excluded.base_url,
        region = excluded.region,
        categories = excluded.categories,
        enabled = excluded.enabled,
        parser = excluded.parser,
        notes = excluded.notes;
    `);
    return get(`SELECT * FROM sources WHERE id = ${sqlQuote(source.id)}`);
  }

  function upsertTender(input) {
    const tender = normalizeTender(input);
    const existing = get(`SELECT id, status, tracking_id FROM tenders WHERE duplicate_key = ${sqlQuote(tender.duplicate_key)}`);
    const id = existing?.id || tender.id;
    const status = existing?.status || tender.status;
    const trackingId = existing?.tracking_id || tender.tracking_id || nextTrackingId(trackingYear(tender));
    run(`
      INSERT INTO tenders (
        id, tracking_id, source_id, source_name, source_url, detail_url, title, organization, country, region, sector,
        opportunity_type, deadline, posted_date, scraped_at, description_raw, description_clean, documents,
        contact_email, submission_url, submission_method, budget_text, eligibility_text, keywords_matched,
        status, duplicate_key, fit_score, urgency_score, eligibility_score, proposal_effort_score, overall_score,
        ai_summary, ai_recommendation, next_action, updated_at
      ) VALUES (
        ${sqlQuote(id)}, ${sqlQuote(trackingId)}, ${sqlQuote(tender.source_id)}, ${sqlQuote(tender.source_name)}, ${sqlQuote(tender.source_url)}, ${sqlQuote(tender.detail_url)}, ${sqlQuote(tender.title)}, ${sqlQuote(tender.organization)}, ${sqlQuote(tender.country)}, ${sqlQuote(tender.region)}, ${sqlQuote(tender.sector)},
        ${sqlQuote(tender.opportunity_type)}, ${sqlQuote(tender.deadline)}, ${sqlQuote(tender.posted_date)}, ${sqlQuote(tender.scraped_at)}, ${sqlQuote(tender.description_raw)}, ${sqlQuote(tender.description_clean)}, ${jsonQuote(tender.documents)},
        ${sqlQuote(tender.contact_email)}, ${sqlQuote(tender.submission_url)}, ${sqlQuote(tender.submission_method)}, ${sqlQuote(tender.budget_text)}, ${sqlQuote(tender.eligibility_text)}, ${jsonQuote(tender.keywords_matched)},
        ${sqlQuote(status)}, ${sqlQuote(tender.duplicate_key)}, ${numberValue(tender.fit_score)}, ${numberValue(tender.urgency_score)}, ${numberValue(tender.eligibility_score)}, ${numberValue(tender.proposal_effort_score)}, ${numberValue(tender.overall_score)},
        ${sqlQuote(tender.ai_summary)}, ${sqlQuote(tender.ai_recommendation)}, ${sqlQuote(tender.next_action)}, CURRENT_TIMESTAMP
      )
      ON CONFLICT(duplicate_key) DO UPDATE SET
        tracking_id = COALESCE(tenders.tracking_id, excluded.tracking_id),
        source_name = excluded.source_name,
        source_url = excluded.source_url,
        detail_url = excluded.detail_url,
        title = excluded.title,
        organization = excluded.organization,
        country = excluded.country,
        region = excluded.region,
        sector = excluded.sector,
        opportunity_type = excluded.opportunity_type,
        deadline = excluded.deadline,
        posted_date = excluded.posted_date,
        scraped_at = excluded.scraped_at,
        description_raw = excluded.description_raw,
        description_clean = excluded.description_clean,
        documents = excluded.documents,
        contact_email = excluded.contact_email,
        submission_url = excluded.submission_url,
        submission_method = excluded.submission_method,
        budget_text = excluded.budget_text,
        eligibility_text = excluded.eligibility_text,
        keywords_matched = excluded.keywords_matched,
        fit_score = excluded.fit_score,
        urgency_score = excluded.urgency_score,
        eligibility_score = excluded.eligibility_score,
        proposal_effort_score = excluded.proposal_effort_score,
        overall_score = excluded.overall_score,
        ai_summary = excluded.ai_summary,
        ai_recommendation = excluded.ai_recommendation,
        next_action = excluded.next_action,
        updated_at = CURRENT_TIMESTAMP;
    `);
    return getTender(id);
  }

  function mapTender(row) {
    if (!row) return null;
    return {
      ...row,
      documents: row.documents ? JSON.parse(row.documents) : [],
      keywords_matched: row.keywords_matched ? JSON.parse(row.keywords_matched) : [],
      open_source_url: openableSourceUrl(row),
      source_link_type: sourceLinkType(row)
    };
  }

  function getTender(id) {
    return mapTender(get(`SELECT * FROM tenders WHERE id = ${sqlQuote(id)}`));
  }

  function listTenders(filters = {}) {
    const where = [];
    if (filters.status) where.push(`status = ${sqlQuote(filters.status)}`);
    if (filters.source_id) where.push(`source_id = ${sqlQuote(filters.source_id)}`);
    if (filters.fit === 'strong') where.push('overall_score >= 70');
    if (filters.fit === 'maybe') where.push('overall_score >= 45 AND overall_score < 70');
    if (filters.fit === 'low') where.push('overall_score < 45');
    if (filters.deadline === 'urgent') where.push(`deadline IS NOT NULL AND deadline >= date('now') AND deadline <= date('now', '+7 day')`);
    if (filters.deadline === 'missing') where.push('(deadline IS NULL OR deadline = "")');
    if (filters.q) {
      const q = `%${String(filters.q).replace(/[%_]/g, '')}%`;
      where.push(`(title LIKE ${sqlQuote(q)} OR organization LIKE ${sqlQuote(q)} OR description_clean LIKE ${sqlQuote(q)})`);
    }
    const sql = `SELECT * FROM tenders ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY CASE WHEN posted_date IS NULL OR posted_date = '' THEN 1 ELSE 0 END ASC, posted_date DESC, overall_score DESC, deadline ASC LIMIT ${Number(filters.limit || 200)}`;
    return all(sql).map(mapTender);
  }

  function updateTenderStatus(id, nextStatus) {
    const current = getTender(id);
    if (!current) throw new Error('Tender not found');
    if (!canTransitionStatus(current.status, nextStatus)) {
      throw new Error(`Invalid status transition: ${current.status} -> ${nextStatus}`);
    }
    run(`
      UPDATE tenders SET status = ${sqlQuote(nextStatus)}, updated_at = CURRENT_TIMESTAMP WHERE id = ${sqlQuote(id)};
      INSERT INTO audit_events (entity_type, entity_id, action, metadata)
      VALUES ('tender', ${sqlQuote(id)}, 'status_changed', ${jsonQuote({ from: current.status, to: nextStatus })});
    `);
    return getTender(id);
  }

  function saveProposalDraft(draft) {
    const id = draft.id || `draft_${Date.now()}_${Math.random().toString(16).slice(2)}`;
    run(`
      INSERT INTO proposal_drafts (id, tender_id, title, markdown, cover_email, checklist_markdown, needs_human_input, confidence_score, status, updated_at)
      VALUES (${sqlQuote(id)}, ${sqlQuote(draft.tender_id)}, ${sqlQuote(draft.title)}, ${sqlQuote(draft.markdown)}, ${sqlQuote(draft.cover_email)}, ${sqlQuote(draft.checklist_markdown)}, ${jsonQuote(draft.needs_human_input)}, ${numberValue(draft.confidence_score)}, ${sqlQuote(draft.status || 'draft')}, CURRENT_TIMESTAMP)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        markdown = excluded.markdown,
        cover_email = excluded.cover_email,
        checklist_markdown = excluded.checklist_markdown,
        needs_human_input = excluded.needs_human_input,
        confidence_score = excluded.confidence_score,
        status = excluded.status,
        updated_at = CURRENT_TIMESTAMP;
    `);
    return get(`SELECT * FROM proposal_drafts WHERE id = ${sqlQuote(id)}`);
  }

  function saveTenderDocument(document) {
    const id = document.id || crypto.createHash('sha1').update(`${document.tender_id}:${document.url || document.filename}:${Date.now()}`).digest('hex').slice(0, 16);
    run(`
      INSERT INTO tender_documents (id, tender_id, url, filename, content_type, parsed_text, summary)
      VALUES (${sqlQuote(id)}, ${sqlQuote(document.tender_id)}, ${sqlQuote(document.url)}, ${sqlQuote(document.filename)}, ${sqlQuote(document.content_type)}, ${sqlQuote(document.parsed_text)}, ${sqlQuote(document.summary)});
    `);
    return get(`SELECT * FROM tender_documents WHERE id = ${sqlQuote(id)}`);
  }

  function listTenderDocuments(tenderId) {
    return all(`SELECT * FROM tender_documents WHERE tender_id = ${sqlQuote(tenderId)} ORDER BY created_at DESC`);
  }

  function replaceActions(actions) {
    run(`
      DELETE FROM actions;
      ${actions.map(action => `
        INSERT INTO actions (id, tender_id, type, label, status, priority, due_at, created_at)
        VALUES (${sqlQuote(action.id)}, ${sqlQuote(action.tender_id)}, ${sqlQuote(action.type)}, ${sqlQuote(action.label)}, ${sqlQuote(action.status || 'open')}, ${numberValue(action.priority || 50)}, ${sqlQuote(action.due_at)}, ${sqlQuote(action.created_at)});
      `).join('\n')}
    `);
    return listActions();
  }

  function listActions() {
    return all('SELECT * FROM actions ORDER BY priority DESC, COALESCE(due_at, "9999-12-31") ASC, created_at DESC LIMIT 200');
  }

  function listProposalDrafts() {
    return all('SELECT * FROM proposal_drafts ORDER BY updated_at DESC LIMIT 100').map(row => ({
      ...row,
      needs_human_input: row.needs_human_input ? JSON.parse(row.needs_human_input) : []
    }));
  }

  function getProposalDraft(id) {
    const row = get(`SELECT * FROM proposal_drafts WHERE id = ${sqlQuote(id)}`);
    if (!row) return null;
    return {
      ...row,
      needs_human_input: row.needs_human_input ? JSON.parse(row.needs_human_input) : []
    };
  }

  function listAuditEvents() {
    return all('SELECT * FROM audit_events ORDER BY id DESC LIMIT 100');
  }

  function listSources() {
    return all(`
      SELECT sources.*, COUNT(tenders.id) AS tender_count
      FROM sources
      LEFT JOIN tenders ON tenders.source_id = sources.id
      GROUP BY sources.id
      ORDER BY sources.enabled DESC, sources.name ASC
    `).map(source => ({
      ...source,
      enabled: Boolean(source.enabled),
      categories: source.categories ? JSON.parse(source.categories) : [],
      tender_count: Number(source.tender_count || 0)
    }));
  }

  function stats() {
    const row = get(`
      SELECT
        COUNT(*) AS total,
        SUM(CASE WHEN status = 'new' THEN 1 ELSE 0 END) AS new_count,
        SUM(CASE WHEN status IN ('shortlisted','draft_required') THEN 1 ELSE 0 END) AS shortlisted_count,
        SUM(CASE WHEN status = 'ready_to_submit' THEN 1 ELSE 0 END) AS ready_count,
        SUM(CASE WHEN status = 'submitted' THEN 1 ELSE 0 END) AS submitted_count,
        SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) AS won_count,
        MAX(overall_score) AS top_score
      FROM tenders
    `);
    return {
      ...(row || {}),
      success_fee_inr: Number(row?.won_count || 0) * 2000
    };
  }

  return {
    dbPath: resolved,
    init,
    upsertSource,
    upsertTender,
    getTender,
    listTenders,
    updateTenderStatus,
    saveProposalDraft,
    saveTenderDocument,
    listTenderDocuments,
    listProposalDrafts,
    getProposalDraft,
    replaceActions,
    listActions,
    listSources,
    listAuditEvents,
    stats
  };
}

module.exports = { createStore, sqlQuote };

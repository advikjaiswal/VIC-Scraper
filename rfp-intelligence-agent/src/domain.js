const crypto = require('node:crypto');

const TENDER_STATUSES = [
  'new',
  'shortlisted',
  'rejected',
  'draft_required',
  'draft_generated',
  'under_review',
  'ready_to_submit',
  'submitted',
  'won',
  'lost',
  'archived'
];

const STATUS_TRANSITIONS = {
  new: ['shortlisted', 'rejected', 'archived'],
  shortlisted: ['draft_required', 'rejected', 'archived'],
  rejected: ['archived', 'shortlisted'],
  draft_required: ['draft_generated', 'rejected', 'archived'],
  draft_generated: ['under_review', 'draft_required', 'archived'],
  under_review: ['ready_to_submit', 'draft_required', 'rejected', 'archived'],
  ready_to_submit: ['submitted', 'under_review', 'archived'],
  submitted: ['won', 'lost', 'archived'],
  won: ['archived'],
  lost: ['archived'],
  archived: ['new']
};

const MONTHS = {
  jan: 1,
  january: 1,
  feb: 2,
  february: 2,
  mar: 3,
  march: 3,
  apr: 4,
  april: 4,
  may: 5,
  jun: 6,
  june: 6,
  jul: 7,
  july: 7,
  aug: 8,
  august: 8,
  sep: 9,
  sept: 9,
  september: 9,
  oct: 10,
  october: 10,
  nov: 11,
  november: 11,
  dec: 12,
  december: 12
};

function cleanText(value) {
  return String(value || '').replace(/\s+/g, ' ').trim();
}

function slug(value) {
  return cleanText(value)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

function isoDate(year, month, day) {
  const y = Number(year);
  const m = Number(month);
  const d = Number(day);
  if (!y || !m || !d || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return `${String(y).padStart(4, '0')}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
}

function parseDeadline(value) {
  const text = cleanText(value);
  if (!text) return null;

  const iso = text.match(/\b(20\d{2})-(\d{1,2})-(\d{1,2})\b/);
  if (iso) return isoDate(iso[1], iso[2], iso[3]);

  const named = text.match(/\b(\d{1,2})(?:st|nd|rd|th)?\s+([A-Za-z]+),?\s+(20\d{2})\b/i);
  if (named) return isoDate(named[3], MONTHS[named[2].toLowerCase()], named[1]);

  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](20\d{2})\b/);
  if (slash) return isoDate(slash[3], slash[2], slash[1]);

  return null;
}

function duplicateKey(input) {
  return [
    slug(input.source_id || input.source_name || 'unknown'),
    slug(input.title),
    slug(input.organization || 'unknown'),
    parseDeadline(input.deadline) || input.deadline || 'no-deadline'
  ].join('|');
}

function idForTender(input) {
  return crypto.createHash('sha1').update(input.duplicate_key || duplicateKey(input)).digest('hex').slice(0, 16);
}

function normalizeTender(input = {}) {
  const title = cleanText(input.title);
  const organization = cleanText(input.organization || 'Unknown organization');
  const deadline = parseDeadline(input.deadline) || null;
  const sourceId = cleanText(input.source_id || 'manual_import');
  const normalized = {
    id: input.id || null,
    source_id: sourceId,
    source_name: cleanText(input.source_name || sourceId),
    source_url: cleanText(input.source_url),
    detail_url: cleanText(input.detail_url || input.source_url),
    title,
    organization,
    country: cleanText(input.country || 'Unknown'),
    region: cleanText(input.region),
    sector: cleanText(input.sector),
    opportunity_type: cleanText(input.opportunity_type || 'RFP'),
    deadline,
    posted_date: parseDeadline(input.posted_date) || null,
    scraped_at: input.scraped_at || new Date().toISOString(),
    description_raw: cleanText(input.description_raw || input.description_clean),
    description_clean: cleanText(input.description_clean || input.description_raw),
    documents: Array.isArray(input.documents) ? input.documents : [],
    contact_email: cleanText(input.contact_email),
    submission_url: cleanText(input.submission_url),
    submission_method: cleanText(input.submission_method),
    budget_text: cleanText(input.budget_text),
    eligibility_text: cleanText(input.eligibility_text),
    keywords_matched: Array.isArray(input.keywords_matched) ? input.keywords_matched : [],
    status: TENDER_STATUSES.includes(input.status) ? input.status : 'new',
    fit_score: Number(input.fit_score || 0),
    urgency_score: Number(input.urgency_score || 0),
    eligibility_score: Number(input.eligibility_score || 0),
    proposal_effort_score: Number(input.proposal_effort_score || 0),
    overall_score: Number(input.overall_score || 0),
    ai_summary: cleanText(input.ai_summary),
    ai_recommendation: cleanText(input.ai_recommendation),
    next_action: cleanText(input.next_action)
  };
  normalized.duplicate_key = input.duplicate_key || duplicateKey(normalized);
  normalized.id = normalized.id || idForTender(normalized);
  return normalized;
}

function canTransitionStatus(from, to) {
  if (!TENDER_STATUSES.includes(from) || !TENDER_STATUSES.includes(to)) return false;
  if (from === to) return true;
  return (STATUS_TRANSITIONS[from] || []).includes(to);
}

module.exports = {
  TENDER_STATUSES,
  STATUS_TRANSITIONS,
  cleanText,
  slug,
  parseDeadline,
  duplicateKey,
  idForTender,
  normalizeTender,
  canTransitionStatus
};

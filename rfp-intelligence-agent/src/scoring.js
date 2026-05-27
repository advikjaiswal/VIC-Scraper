const { cleanText } = require('./domain');

const HIGH_VALUE_KEYWORDS = [
  'impact evaluation',
  'impact assessment',
  'program evaluation',
  'programme evaluation',
  'external project evaluation',
  'independent research study',
  'baseline assessment',
  'baseline',
  'endline',
  'midline',
  'monitoring and evaluation',
  'monitoring, evaluation',
  'mel',
  'social impact assessment',
  'csr',
  'ngo',
  'research study',
  'data collection',
  'evaluation agency',
  'qualitative research',
  'quantitative research',
  'development sector',
  'livelihoods',
  'education',
  'health',
  'gender',
  'climate',
  'wash',
  'skilling',
  'rural development'
];

const CORE_FIT_TERMS = [
  'impact evaluation',
  'impact assessment',
  'program evaluation',
  'programme evaluation',
  'external project evaluation',
  'independent research study',
  'baseline assessment',
  'endline evaluation',
  'social impact assessment',
  'evaluation survey'
];

const EVIDENCE_TERMS = [
  'baseline',
  'endline',
  'midline',
  'research study',
  'data collection',
  'qualitative research',
  'quantitative research',
  'monitoring and evaluation',
  'mel'
];

const SECTOR_TERMS = [
  'csr',
  'ngo',
  'development sector',
  'livelihoods',
  'education',
  'health',
  'gender',
  'climate',
  'wash',
  'skilling',
  'rural development'
];

const WEAK_OR_NOISY_TERMS = [
  'construction',
  'equipment',
  'supply of goods',
  'road',
  'civil work',
  'hardware',
  'digital agency',
  'vendor onboarding',
  'onboarding a eap vendor',
  'background verification',
  'bgv agency',
  'civil contractor',
  'plumbing'
];

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function textFor(tender) {
  return `${tender.title || ''} ${tender.sector || ''} ${tender.description_clean || ''} ${tender.eligibility_text || ''}`.toLowerCase();
}

function countMatches(text, terms) {
  return terms.filter(term => text.includes(term)).length;
}

function daysUntil(deadline, now = new Date()) {
  if (!deadline) return null;
  const target = new Date(`${deadline}T23:59:59Z`);
  if (Number.isNaN(target.getTime())) return null;
  return Math.ceil((target.getTime() - now.getTime()) / 86400000);
}

function scoreTender(tender, options = {}) {
  const now = options.now || new Date();
  const lower = textFor(tender);
  const matches = HIGH_VALUE_KEYWORDS.filter(term => lower.includes(term));
  const coreMatches = countMatches(lower, CORE_FIT_TERMS);
  const evidenceMatches = countMatches(lower, EVIDENCE_TERMS);
  const sectorMatches = countMatches(lower, SECTOR_TERMS);
  const noisy = countMatches(lower, WEAK_OR_NOISY_TERMS);
  const days = daysUntil(tender.deadline, now);
  const docs = Array.isArray(tender.documents) ? tender.documents : [];
  const country = cleanText(tender.country).toLowerCase();
  const sourceId = cleanText(tender.source_id).toLowerCase();

  const topic_score = clamp(coreMatches * 75 + evidenceMatches * 16 + sectorMatches * 8 - noisy * 28);
  const geography_score = clamp(country.includes('india') ? 92 : country && country !== 'unknown' ? 72 : 45);
  const deadline_score = days === null ? 45 : days < 0 ? 0 : days <= 10 ? 92 : days <= 30 ? 76 : days <= 60 ? 55 : 35;
  const document_availability_score = clamp(docs.length ? 88 : /pdf|docx?|download|tor|terms of reference/i.test(lower) ? 65 : 35);
  const eligibility_score = clamp(/qualified|eligible|agency|consultant|firm|experience/i.test(lower) ? 72 : 48);
  const commercial_value_score = clamp(/budget|inr|usd|fees|financial proposal|lump sum/i.test(lower) ? 70 : 48);
  const proposal_effort_score = clamp(/two-phase|multi[- ]?year|technical proposal|financial proposal|presentation/i.test(lower) ? 42 : 70);
  const source_reliability_score = clamp(['devnetjobsindia', 'ngobox', 'ungm', 'giz-india', 'indevjobs', 'manual_import'].includes(sourceId) ? 82 : 58);
  const duplicate_penalty = tender.is_duplicate ? 25 : 0;

  const overall_score = clamp(
    topic_score * 0.4 +
    geography_score * 0.1 +
    deadline_score * 0.12 +
    document_availability_score * 0.08 +
    eligibility_score * 0.08 +
    commercial_value_score * 0.06 +
    source_reliability_score * 0.1 +
    proposal_effort_score * 0.06 -
    duplicate_penalty
  );

  const labels = labelsFor({ topic_score, deadline_score, document_availability_score, overall_score, days, duplicate_penalty });
  return {
    ...tender,
    keywords_matched: matches,
    topic_score,
    geography_score,
    deadline_score,
    document_availability_score,
    eligibility_score,
    commercial_value_score,
    proposal_effort_score,
    source_reliability_score,
    duplicate_penalty,
    fit_score: topic_score,
    urgency_score: deadline_score,
    overall_score,
    labels,
    ai_summary: tender.ai_summary || buildSummary(tender, matches, days),
    ai_recommendation: tender.ai_recommendation || recommendationFor(overall_score, days, document_availability_score),
    next_action: tender.next_action || nextActionFor(overall_score, days, document_availability_score)
  };
}

function labelsFor(scores) {
  const labels = [];
  if (scores.days !== null && scores.days < 0) labels.push('expired');
  if (scores.overall_score >= 70) labels.push('strong_fit');
  else if (scores.overall_score >= 45) labels.push('maybe_fit');
  else labels.push('low_fit');
  if (scores.days !== null && scores.days >= 0 && scores.days <= 14) labels.push('urgent');
  if (scores.document_availability_score < 50) labels.push('missing_docs');
  if (scores.duplicate_penalty) labels.push('duplicate');
  return labels;
}

function classifyTender(scored) {
  if ((scored.labels || []).includes('expired')) return 'expired';
  if ((scored.labels || []).includes('duplicate')) return 'duplicate';
  if ((scored.labels || []).includes('strong_fit')) return 'strong_fit';
  if ((scored.labels || []).includes('maybe_fit')) return 'maybe_fit';
  return 'low_fit';
}

function buildSummary(tender, matches, days) {
  const deadline = days === null ? 'No reliable deadline detected.' : days < 0 ? 'Deadline has passed.' : `Deadline is in ${days} day(s).`;
  const focus = matches.length ? `Matched: ${matches.slice(0, 6).join(', ')}.` : 'No strong evaluation keywords detected.';
  return `${tender.organization || 'The buyer'} is requesting ${tender.title || 'an opportunity'}. ${focus} ${deadline}`;
}

function recommendationFor(score, days, docScore) {
  if (days !== null && days < 0) return 'Expired. Archive unless reopened.';
  if (score >= 70) return 'Strong fit. Review quickly and prepare a proposal decision.';
  if (docScore < 50) return 'Potential fit, but documents are missing. Retrieve RFP documents before bid decision.';
  if (score >= 45) return 'Maybe fit. Assign a human review before drafting.';
  return 'Low fit. Reject unless a strategic reason exists.';
}

function nextActionFor(score, days, docScore) {
  if (days !== null && days < 0) return 'Archive expired opportunity';
  if (docScore < 50) return 'Find or upload tender document';
  if (score >= 70) return 'Shortlist and generate proposal pack';
  if (score >= 45) return 'Review fit manually';
  return 'Reject or archive';
}

module.exports = {
  HIGH_VALUE_KEYWORDS,
  scoreTender,
  classifyTender,
  daysUntil,
  clamp
};

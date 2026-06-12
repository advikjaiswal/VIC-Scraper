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

const SOCIAL_IMPACT_TERMS = [
  'social impact',
  'social impact assessment',
  'impact assessment',
  'impact evaluation',
  'csr impact',
  'csr evaluation',
  'corporate social responsibility',
  'community development',
  'livelihoods',
  'education',
  'health',
  'gender',
  'wash',
  'rural development',
  'skilling'
];

const PRIORITY_COMPANIES = [
  'jsw',
  'jsw steel',
  'tata',
  'tata steel',
  'tata trusts',
  'reliance foundation',
  'adani',
  'adani foundation',
  'vedanta',
  'hindustan zinc',
  'mahindra',
  'azim premji',
  'infosys foundation',
  'wipro',
  'hcl foundation',
  'godrej',
  'itc',
  'larsen and toubro',
  'l&t',
  'bharat petroleum',
  'indian oil',
  'ongc',
  'ntpc',
  'power grid'
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
  return `${tender.title || ''} ${tender.organization || ''} ${tender.sector || ''} ${tender.country || ''} ${tender.region || ''} ${tender.description_clean || ''} ${tender.eligibility_text || ''}`.toLowerCase();
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

function daysSince(date, now = new Date()) {
  if (!date) return null;
  const published = new Date(`${date}T00:00:00Z`);
  if (Number.isNaN(published.getTime())) return null;
  return Math.floor((now.getTime() - published.getTime()) / 86400000);
}

function scoreTender(tender, options = {}) {
  const now = options.now || new Date();
  const lower = textFor(tender);
  const matches = HIGH_VALUE_KEYWORDS.filter(term => lower.includes(term));
  const coreMatches = countMatches(lower, CORE_FIT_TERMS);
  const evidenceMatches = countMatches(lower, EVIDENCE_TERMS);
  const sectorMatches = countMatches(lower, SECTOR_TERMS);
  const socialImpactMatches = countMatches(lower, SOCIAL_IMPACT_TERMS);
  const companyMatches = PRIORITY_COMPANIES.filter(company => lower.includes(company));
  const noisy = countMatches(lower, WEAK_OR_NOISY_TERMS);
  const days = daysUntil(tender.deadline, now);
  const publishedAge = daysSince(tender.posted_date, now);
  const docs = Array.isArray(tender.documents) ? tender.documents : [];
  const country = cleanText(tender.country).toLowerCase();
  const region = cleanText(tender.region).toLowerCase();
  const sourceId = cleanText(tender.source_id).toLowerCase();
  const indiaSource = ['devnetjobsindia', 'ngobox', 'giz-india', 'undp-search', 'linkedin-assisted'].includes(sourceId);

  const topic_score = clamp(coreMatches * 68 + socialImpactMatches * 20 + evidenceMatches * 13 + sectorMatches * 5 - noisy * 28);
  const geography_score = clamp(country.includes('india') || region.includes('india') || indiaSource || lower.includes(' india ') ? 96 : country && country !== 'unknown' ? 45 : 38);
  const company_priority_score = clamp(companyMatches.length ? 95 : 45);
  const deadline_score = days === null ? 45 : days < 0 ? 0 : days <= 10 ? 92 : days <= 30 ? 76 : days <= 60 ? 55 : 35;
  const freshness_score = publishedAge === null ? 50 : publishedAge < 0 ? 45 : publishedAge <= 7 ? 96 : publishedAge <= 21 ? 82 : publishedAge <= 45 ? 62 : 34;
  const document_availability_score = clamp(docs.length ? 88 : /pdf|docx?|download|tor|terms of reference/i.test(lower) ? 65 : 35);
  const eligibility_score = clamp(/qualified|eligible|agency|consultant|firm|experience/i.test(lower) ? 72 : 48);
  const commercial_value_score = clamp(/budget|inr|usd|fees|financial proposal|lump sum/i.test(lower) ? 70 : 48);
  const proposal_effort_score = clamp(/two-phase|multi[- ]?year|technical proposal|financial proposal|presentation/i.test(lower) ? 42 : 70);
  const source_reliability_score = clamp(['devnetjobsindia', 'ngobox', 'ungm', 'giz-india', 'indevjobs', 'manual_import', 'linkedin-assisted'].includes(sourceId) ? 82 : 58);
  const duplicate_penalty = tender.is_duplicate ? 25 : 0;

  const rawOverall = clamp(
    topic_score * 0.32 +
    geography_score * 0.18 +
    freshness_score * 0.14 +
    deadline_score * 0.1 +
    company_priority_score * 0.08 +
    document_availability_score * 0.06 +
    eligibility_score * 0.06 +
    commercial_value_score * 0.03 +
    source_reliability_score * 0.05 +
    proposal_effort_score * 0.02 -
    duplicate_penalty
  );
  const overall_score = days !== null && days < 0 ? Math.min(rawOverall, 30) : rawOverall;

  const labels = labelsFor({ topic_score, deadline_score, document_availability_score, overall_score, days, duplicate_penalty, geography_score, freshness_score, companyMatches, socialImpactMatches });
  return {
    ...tender,
    keywords_matched: Array.from(new Set([...matches, ...companyMatches])),
    topic_score,
    geography_score,
    freshness_score,
    company_priority_score,
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
  if (scores.geography_score >= 90) labels.push('india_priority');
  if (scores.socialImpactMatches > 0) labels.push('social_impact');
  if (scores.companyMatches.length) labels.push('known_company');
  if (scores.freshness_score >= 82) labels.push('latest');
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
  SOCIAL_IMPACT_TERMS,
  PRIORITY_COMPANIES,
  scoreTender,
  classifyTender,
  daysUntil,
  daysSince,
  clamp
};

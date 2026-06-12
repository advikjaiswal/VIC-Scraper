const { normalizeTender, cleanText, parseDeadline } = require('./domain');
const { isUnsafeSourceUrl } = require('./sourceLinks');

const RFP_TERMS = [
  'rfp',
  'request for proposal',
  'eoi',
  'expression of interest',
  'impact evaluation',
  'program evaluation',
  'programme evaluation',
  'baseline',
  'midline',
  'endline',
  'mel',
  'monitoring and evaluation',
  'social impact assessment',
  'research study',
  'evaluation agency',
  'consultancy'
];

function decodeHtml(value) {
  return String(value || '')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function stripTags(value) {
  return cleanText(decodeHtml(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' ')));
}

function absoluteUrl(href, baseUrl) {
  if (!href) return '';
  if (isUnsafeSourceUrl(href)) return '';
  try {
    const url = new URL(decodeHtml(href), baseUrl).toString();
    return isUnsafeSourceUrl(url) ? '' : url;
  } catch (_) {
    return '';
  }
}

function linkRecords(html, baseUrl) {
  const records = [];
  const re = /<a\b([^>]*)>([\s\S]*?)<\/a>/gi;
  let match;
  while ((match = re.exec(String(html || '')))) {
    const attrs = match[1] || '';
    const href = attrs.match(/\bhref\s*=\s*(["'])(.*?)\1/i);
    const text = stripTags(match[2]);
    const url = href ? absoluteUrl(href[2], baseUrl) : '';
    if (text && url) records.push({ text, url, raw: match[0] });
  }
  return records;
}

function relevant(text) {
  const lower = String(text || '').toLowerCase();
  return RFP_TERMS.some(term => lower.includes(term));
}

function blockAround(html, needle) {
  const index = String(html || '').indexOf(needle);
  if (index < 0) return '';
  return String(html).slice(Math.max(0, index - 800), Math.min(String(html).length, index + 1200));
}

function organizationFromText(text) {
  const org = text.match(/(?:organization|organisation|client|agency)\s*:?\s*([A-Za-z0-9 &.,'()-]{3,90}?)(?=\s+(?:posted|published|publication date|date posted|issue date|released on|uploaded on|deadline|last date|closing date|due date|apply by)\b|$)/i);
  return org ? cleanText(org[1]) : '';
}

function deadlineFromText(text) {
  const explicit = text.match(/(?:deadline|last date|closing date|due date|apply by)\s*:?\s*([A-Za-z0-9 ,/-]{6,40})/i);
  return parseDeadline(explicit ? explicit[1] : text);
}

function postedDateFromText(text) {
  const explicit = text.match(/(?:posted|published|publication date|date posted|issue date|released on|uploaded on)\s*:?\s*([A-Za-z0-9 ,/-]{6,40})/i);
  return parseDeadline(explicit ? explicit[1] : '');
}

function documentsFromBlock(block, baseUrl) {
  return linkRecords(block, baseUrl)
    .filter(link => /\.(pdf|doc|docx)(?:\?|$)/i.test(link.url) || /tor|download|document/i.test(link.text))
    .map(link => ({ title: link.text, url: link.url }));
}

function tenderFromLink(link, source, block = '') {
  const text = stripTags(block) || link.text;
  return normalizeTender({
    source_id: source.id,
    source_name: source.name,
    source_url: source.base_url,
    detail_url: link.url,
    title: link.text,
    organization: organizationFromText(text) || 'Unknown organization',
    country: source.region === 'India' ? 'India' : 'Unknown',
    region: source.region || '',
    opportunity_type: /eoi|expression/i.test(link.text) ? 'EOI' : 'RFP',
    deadline: deadlineFromText(text),
    posted_date: postedDateFromText(text),
    description_raw: text,
    documents: documentsFromBlock(block, source.base_url)
  });
}

function parseGenericLinks(html, source) {
  const tenders = [];
  const seen = new Set();
  for (const link of linkRecords(html, source.base_url)) {
    const block = blockAround(html, link.raw);
    if (!relevant(link.text)) continue;
    if (seen.has(link.url)) continue;
    seen.add(link.url);
    tenders.push(tenderFromLink(link, source, block));
  }
  return tenders;
}

function parseDevNetJobsIndia(html, source) {
  const rows = Array.from(String(html || '').matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)).map(match => match[1]);
  const tenders = [];
  for (const row of rows) {
    const rawLink = row.match(/<a\b([^>]*)>([\s\S]*?)<\/a>/i);
    if (!rawLink) continue;
    const text = stripTags(rawLink[2]);
    if (!relevant(text)) continue;
    const href = (rawLink[1] || '').match(/\bhref\s*=\s*(["'])(.*?)\1/i);
    const detailUrl = href ? absoluteUrl(href[2], source.base_url) : '';
    const cells = Array.from(row.matchAll(/<td[^>]*>([\s\S]*?)<\/td>/gi)).map(cell => stripTags(cell[1])).filter(Boolean);
    tenders.push(normalizeTender({
      source_id: source.id,
      source_name: source.name,
      source_url: source.base_url,
      detail_url: detailUrl || source.base_url,
      title: text,
      organization: cells.find(cell => cell !== text && !parseDeadline(cell) && !/^india$/i.test(cell)) || 'Unknown organization',
      country: cells.find(cell => /^india$/i.test(cell)) || (source.region === 'India' ? 'India' : 'Unknown'),
      region: source.region || '',
      deadline: deadlineFromText(stripTags(row)),
      posted_date: postedDateFromText(stripTags(row)),
      description_raw: stripTags(row),
      documents: documentsFromBlock(row, source.base_url)
    }));
  }
  return tenders.length ? tenders : parseGenericLinks(html, source);
}

function parseNgoBox(html, source) {
  return parseGenericLinks(html, source).map(tender => {
    const block = blockAround(html, tender.detail_url.replace(/^https?:\/\/[^/]+/i, ''));
    const text = stripTags(block);
    return {
      ...tender,
      organization: organizationFromText(text) || tender.organization,
      deadline: deadlineFromText(text) || tender.deadline,
      posted_date: postedDateFromText(text) || tender.posted_date,
      documents: documentsFromBlock(block, source.base_url)
    };
  });
}

function parseGizIndia(html, source) {
  return parseGenericLinks(html, source);
}

function parseIndevJobs(html, source) {
  return parseGenericLinks(html, source);
}

function parseUngm(html, source) {
  return parseGenericLinks(html, source);
}

function parserFor(name) {
  return {
    devnetjobsindia: parseDevNetJobsIndia,
    ngobox: parseNgoBox,
    gizIndia: parseGizIndia,
    indevjobs: parseIndevJobs,
    ungm: parseUngm,
    searchFallback: parseGenericLinks
  }[name] || parseGenericLinks;
}

module.exports = {
  RFP_TERMS,
  decodeHtml,
  stripTags,
  absoluteUrl,
  linkRecords,
  postedDateFromText,
  parseGenericLinks,
  parseDevNetJobsIndia,
  parseNgoBox,
  parseGizIndia,
  parseIndevJobs,
  parseUngm,
  parserFor
};

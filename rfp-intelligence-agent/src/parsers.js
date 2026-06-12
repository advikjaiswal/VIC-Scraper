const { normalizeTender, cleanText, parseDeadline, slug } = require('./domain');
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
  const org = text.match(/(?:organization|organisation|client|agency|issued by|buyer|department)\s*:?\s*([A-Za-z0-9 &.,'()-]{3,110}?)(?=\s+(?:posted|published|publication date|date posted|issue date|released on|uploaded on|deadline|last date|closing date|due date|apply by|download|view|add to google calendar)\b|$)/i);
  return org ? cleanOrganization(org[1]) : '';
}

function cleanOrganization(value) {
  const cleaned = cleanText(value)
    .replace(/\s*Add to Google Calendar\s*$/i, '')
    .replace(/^s\s+(?=[A-Z])/i, '')
    .replace(/^[-–:|]+|[-–:|]+$/g, '')
    .trim();
  if (!cleaned || /^unknown organization$/i.test(cleaned)) return '';
  if (/^(rfp|eoi|tenders?|post a rfp|request for proposal|rfp assignments aspx|rfp eoi listing php)$/i.test(cleaned)) return '';
  return cleaned;
}

function titleCaseFromSlug(value) {
  const words = String(value || '').split('-').filter(Boolean);
  return words.map(word => {
    const upper = word.toUpperCase();
    if (['AIF', 'CSR', 'HCL', 'JSW', 'NGO', 'UNDP', 'UNICEF', 'WASH'].includes(upper)) return upper;
    return word.charAt(0).toUpperCase() + word.slice(1);
  }).join(' ');
}

function organizationFromUrl(url, title = '') {
  if (!url) return '';
  let lastSegment = '';
  try {
    lastSegment = decodeURIComponent(new URL(url).pathname.split('/').filter(Boolean).pop() || '');
  } catch (_) {
    return '';
  }

  const withoutId = lastSegment.replace(/_\d+$/i, '').replace(/^full_rfp_eoi_/i, '');
  if (/\.(aspx?|php|html?)$/i.test(withoutId)) return '';
  let normalized = slug(withoutId);
  const titleSlug = slug(title);
  if (!normalized) return '';

  if (titleSlug && normalized.startsWith(titleSlug)) {
    normalized = normalized.slice(titleSlug.length).replace(/^-+/, '');
  }

  if (!normalized || normalized === titleSlug) return '';

  const candidate = titleCaseFromSlug(normalized);
  return cleanOrganization(candidate);
}

function inferOrganization(input = {}) {
  const current = cleanOrganization(input.organization);
  if (current) return current;
  return organizationFromText(`${input.description_raw || ''} ${input.description_clean || ''}`)
    || organizationFromUrl(input.detail_url, input.title);
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
  const organization = inferOrganization({
    title: link.text,
    detail_url: link.url,
    source_url: source.base_url,
    description_raw: text
  });
  return normalizeTender({
    source_id: source.id,
    source_name: source.name,
    source_url: source.base_url,
    detail_url: link.url,
    title: link.text,
    organization: organization || 'Unknown organization',
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
    const organization = inferOrganization({ ...tender, description_raw: text });
    return {
      ...tender,
      organization: organization || tender.organization,
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
  cleanOrganization,
  organizationFromUrl,
  inferOrganization,
  postedDateFromText,
  parseGenericLinks,
  parseDevNetJobsIndia,
  parseNgoBox,
  parseGizIndia,
  parseIndevJobs,
  parseUngm,
  parserFor
};

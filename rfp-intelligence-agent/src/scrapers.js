const { fetchText, withRetry } = require('./http');
const { parserFor } = require('./parsers');

async function scrapePublicHtml(source, options = {}) {
  if (!source.base_url) return [];
  const html = await withRetry(() => fetchText(source.base_url, { timeoutMs: options.timeoutMs || 15000 }), { retries: options.retries ?? 1 });
  const parser = parserFor(source.parser);
  return parser(html, source);
}

async function scrapeSearchFallback(source) {
  return [{
    source_id: source.id,
    source_name: source.name,
    source_url: source.base_url,
    detail_url: source.base_url,
    title: `${source.name}: manual search review required`,
    organization: 'Manual review',
    country: source.region || 'Unknown',
    deadline: null,
    description_clean: 'This source is configured as a search fallback. Review the source page or import links manually when public search access is limited.',
    documents: []
  }];
}

function linkedInSearchUrl(query) {
  return `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(query)}`;
}

async function scrapeLinkedInAssisted(source) {
  const today = new Date().toISOString().slice(0, 10);
  const searches = [
    {
      query: 'India CSR social impact assessment RFP evaluation agency',
      title: 'LinkedIn assisted review: India CSR social impact assessment posts',
      description: 'Review recent LinkedIn company and CSR posts for social impact assessment, CSR evaluation, and evaluation agency opportunities in India.'
    },
    {
      query: 'JSW Foundation impact assessment RFP CSR evaluation',
      title: 'LinkedIn assisted review: JSW social impact and CSR RFP posts',
      description: 'Priority known-company search for JSW/JSW Foundation social impact, CSR evaluation, and proposal calls.'
    },
    {
      query: 'India baseline endline evaluation consultancy CSR NGO',
      title: 'LinkedIn assisted review: India baseline/endline evaluation consultancy posts',
      description: 'Review recent LinkedIn posts for baseline, midline, endline, MEL, and evaluation consultancy opportunities in India.'
    }
  ];
  return searches.map(item => ({
    source_id: source.id,
    source_name: source.name,
    source_url: source.base_url,
    detail_url: linkedInSearchUrl(item.query),
    title: item.title,
    organization: 'LinkedIn assisted search',
    country: 'India',
    region: 'India',
    posted_date: today,
    deadline: null,
    description_clean: `${item.description} LinkedIn is handled as assisted review only; open the source search and manually import any relevant post or company opportunity.`,
    documents: []
  }));
}

function adapterFor(source) {
  if (source.type === 'public_html') return scrapePublicHtml;
  if (source.type === 'search_fallback') return scrapeSearchFallback;
  if (source.type === 'assisted_linkedin') return scrapeLinkedInAssisted;
  return async () => [];
}

module.exports = { scrapePublicHtml, scrapeSearchFallback, scrapeLinkedInAssisted, adapterFor };

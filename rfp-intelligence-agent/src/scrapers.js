const { fetchText, withRetry } = require('./http');
const { parserFor } = require('./parsers');
const { duplicateKey } = require('./domain');

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
  return `https://www.linkedin.com/search/results/content/?keywords=${encodeURIComponent(query)}&datePosted=%22past-week%22&sortBy=%22date_posted%22`;
}

async function scrapeLinkedInAssisted(source) {
  const today = new Date().toISOString().slice(0, 10);
  const searches = [
    {
      keyTitle: 'LinkedIn assisted review: India CSR social impact assessment posts',
      query: '"request for proposal" OR RFP "social impact assessment" India CSR evaluation agency',
      title: 'LinkedIn RFP finder: India CSR social impact assessment proposal calls',
      organization: 'LinkedIn RFP search',
      description: 'Review recent LinkedIn results that explicitly mention request for proposal, RFP, proposal calls, social impact assessment, CSR evaluation, and evaluation agency opportunities in India.'
    },
    {
      keyTitle: 'LinkedIn assisted review: JSW social impact and CSR RFP posts',
      query: '"inviting proposals" OR RFP "JSW Foundation" "impact assessment" CSR evaluation',
      title: 'LinkedIn RFP finder: JSW Foundation impact assessment proposal calls',
      organization: 'JSW Foundation LinkedIn search',
      description: 'Priority known-company search for JSW/JSW Foundation posts that mention inviting proposals, RFPs, impact assessment, and CSR evaluation.'
    },
    {
      keyTitle: 'LinkedIn assisted review: India baseline/endline evaluation consultancy posts',
      query: '"proposal deadline" OR "inviting proposals" baseline endline evaluation consultancy India NGO CSR',
      title: 'LinkedIn RFP finder: India baseline/endline evaluation proposal calls',
      organization: 'LinkedIn RFP search',
      description: 'Review recent LinkedIn results that mention proposal deadlines or inviting proposals for baseline, endline, MEL, and evaluation consultancy opportunities in India.'
    }
  ];
  return searches.map(item => ({
    source_id: source.id,
    source_name: source.name,
    source_url: source.base_url,
    detail_url: linkedInSearchUrl(item.query),
    title: item.title,
    organization: item.organization,
    country: 'India',
    region: 'India',
    opportunity_type: 'LinkedIn RFP search',
    posted_date: today,
    deadline: null,
    duplicate_key: duplicateKey({
      source_id: source.id,
      title: item.keyTitle,
      organization: 'LinkedIn assisted search',
      deadline: null
    }),
    description_clean: `${item.description} LinkedIn is handled as assisted review only; open the filtered search, verify the original post, and import only actual RFP/proposal calls.`,
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

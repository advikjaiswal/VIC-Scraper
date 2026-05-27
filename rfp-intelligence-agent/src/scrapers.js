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

function adapterFor(source) {
  if (source.type === 'public_html') return scrapePublicHtml;
  if (source.type === 'search_fallback') return scrapeSearchFallback;
  return async () => [];
}

module.exports = { scrapePublicHtml, scrapeSearchFallback, adapterFor };

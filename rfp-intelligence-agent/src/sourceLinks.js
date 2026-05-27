function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || ''));
}

function isUnsafeSourceUrl(value) {
  const text = String(value || '').trim().toLowerCase();
  return !text || text.startsWith('javascript:') || text.startsWith('#') || text.startsWith('mailto:');
}

function openableSourceUrl(tender) {
  if (isHttpUrl(tender.detail_url) && !isUnsafeSourceUrl(tender.detail_url)) return tender.detail_url;
  if (isHttpUrl(tender.source_url) && !isUnsafeSourceUrl(tender.source_url)) return tender.source_url;
  return '';
}

function sourceLinkType(tender) {
  if (
    isHttpUrl(tender.source_url) &&
    isHttpUrl(tender.detail_url) &&
    String(tender.source_url) === String(tender.detail_url)
  ) return 'listing';
  if (isHttpUrl(tender.detail_url) && !isUnsafeSourceUrl(tender.detail_url)) return 'detail';
  if (isHttpUrl(tender.source_url) && !isUnsafeSourceUrl(tender.source_url)) return 'listing';
  return 'unavailable';
}

module.exports = { isHttpUrl, isUnsafeSourceUrl, openableSourceUrl, sourceLinkType };

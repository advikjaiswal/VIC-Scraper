const SOURCES = [
  {
    id: 'devnetjobsindia',
    name: 'DevNetJobsIndia RFP Assignments',
    type: 'public_html',
    base_url: 'https://www.devnetjobsindia.org/rfp_assignments.aspx',
    region: 'India',
    categories: ['impact evaluation', 'research consulting', 'development sector'],
    enabled: true,
    parser: 'devnetjobsindia',
    notes: 'Priority public HTML source with a dedicated parser.',
    health_status: 'configured'
  },
  {
    id: 'ngobox',
    name: 'NGO Box RFP/EOI Listing',
    type: 'public_html',
    base_url: 'https://ngobox.org/rfp_eoi_listing.php',
    region: 'India',
    categories: ['ngo', 'csr', 'evaluation'],
    enabled: true,
    parser: 'ngobox',
    notes: 'Priority public listing. Some details may require page-specific parsing.',
    health_status: 'configured'
  },
  {
    id: 'ungm',
    name: 'UNGM Global Marketplace',
    type: 'public_html',
    base_url: 'https://www.ungm.org/Public/Notice',
    region: 'International',
    categories: ['UN procurement', 'consulting', 'evaluation'],
    enabled: true,
    parser: 'ungm',
    notes: 'Public portal; browser rendering or query endpoint may be needed if HTML changes.',
    health_status: 'configured'
  },
  {
    id: 'giz-india',
    name: 'GIZ India Procurement',
    type: 'public_html',
    base_url: 'https://www.giz.de/en/worldwide/122734.html',
    region: 'India',
    categories: ['GIZ', 'development sector', 'consulting'],
    enabled: true,
    parser: 'gizIndia',
    notes: 'Public page with conservative tender link extraction.',
    health_status: 'configured'
  },
  {
    id: 'indevjobs',
    name: 'Indev Jobs',
    type: 'public_html',
    base_url: 'https://www.indevjobs.org/',
    region: 'International',
    categories: ['development jobs', 'consulting', 'RFP'],
    enabled: true,
    parser: 'indevjobs',
    notes: 'May mix jobs and consulting opportunities; scoring should filter aggressively.',
    health_status: 'configured'
  },
  {
    id: 'undp-search',
    name: 'UNDP India Procurement Search Fallback',
    type: 'search_fallback',
    base_url: 'https://www.undp.org/india/procurement',
    region: 'India',
    categories: ['UNDP', 'procurement', 'evaluation'],
    enabled: true,
    parser: 'searchFallback',
    notes: 'Fallback queries preferred if procurement page blocks or changes HTML.',
    health_status: 'configured'
  },
  {
    id: 'linkedin-assisted',
    name: 'LinkedIn Assisted Import',
    type: 'assisted_linkedin',
    base_url: 'https://www.linkedin.com/',
    region: 'International',
    categories: ['assisted import', 'company posts'],
    enabled: false,
    parser: 'manualImport',
    notes: 'No risky login scraping. Use manual import or approved official access only.',
    health_status: 'limited'
  }
];

function seedSources(store) {
  for (const source of SOURCES) store.upsertSource(source);
}

module.exports = { SOURCES, seedSources };

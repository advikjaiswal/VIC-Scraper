const { normalizeTender } = require('./domain');
const { scoreTender } = require('./scoring');
const { adapterFor } = require('./scrapers');
const { SOURCES } = require('./sources');

async function runScan({ store, sources = SOURCES, adapters = {}, now = new Date(), options = {} }) {
  const started = new Date().toISOString();
  const run = {
    id: `scan_${Date.now()}`,
    status: 'completed',
    found: 0,
    saved: 0,
    updated: 0,
    skipped: 0,
    errors: [],
    started_at: started,
    finished_at: null
  };

  for (const source of sources.filter(source => source.enabled !== false)) {
    try {
      const adapter = adapters[source.id] || adapterFor(source);
      const rawItems = await adapter(source, options);
      run.found += rawItems.length;
      for (const item of rawItems) {
        if (!item.title) {
          run.skipped += 1;
          continue;
        }
        const scored = scoreTender(normalizeTender({ ...item, source_id: item.source_id || source.id, source_name: item.source_name || source.name }), { now });
        const existing = store.getTender(scored.id);
        store.upsertTender(scored);
        if (existing) run.updated += 1;
        else run.saved += 1;
      }
    } catch (error) {
      run.errors.push({ source_id: source.id, source_name: source.name, message: error.message });
    }
  }

  run.finished_at = new Date().toISOString();
  if (run.errors.length && run.saved === 0) run.status = 'completed_with_errors';
  return run;
}

module.exports = { runScan };

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createStore } = require('../src/storage');
const { runScan } = require('../src/scanner');
const { scrapeLinkedInAssisted } = require('../src/scrapers');

test('scan runner saves successes and records source failures without crashing', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfp-scan-'));
  const store = createStore(path.join(dir, 'scan.sqlite'));
  store.init();

  const adapters = {
    ok: async () => [{
      source_id: 'ok',
      source_name: 'OK Source',
      title: 'Impact Evaluation RFP',
      organization: 'Example NGO',
      country: 'India',
      deadline: '2026-06-05',
      description_clean: 'impact evaluation baseline endline'
    }],
    bad: async () => {
      throw new Error('blocked');
    }
  };

  const run = await runScan({
    store,
    sources: [
      { id: 'ok', name: 'OK Source', enabled: true },
      { id: 'bad', name: 'Bad Source', enabled: true }
    ],
    adapters,
    now: new Date('2026-05-26T00:00:00Z')
  });

  assert.equal(run.found, 1);
  assert.equal(run.saved, 1);
  assert.equal(run.errors.length, 1);
  assert.equal(store.listTenders({}).length, 1);
});

test('LinkedIn assisted source creates safe India social-impact review items', async () => {
  const items = await scrapeLinkedInAssisted({
    id: 'linkedin-assisted',
    name: 'LinkedIn Assisted Search',
    base_url: 'https://www.linkedin.com/'
  });

  assert.equal(items.length >= 3, true);
  assert.ok(items.every(item => item.country === 'India'));
  assert.ok(items.every(item => item.detail_url.startsWith('https://www.linkedin.com/search/results/content/')));
  assert.ok(items.some(item => /JSW/i.test(item.title + item.description_clean)));
});

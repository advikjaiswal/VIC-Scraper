const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createStore } = require('../src/storage');

test('stores, deduplicates, updates status, and records audit trail', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfp-store-'));
  const store = createStore(path.join(dir, 'test.sqlite'));
  store.init();

  const first = store.upsertTender({
    source_id: 'devnetjobsindia',
    source_name: 'DevNetJobsIndia',
    title: 'Impact Evaluation RFP',
    organization: 'Example Foundation',
    country: 'India',
    deadline: '2026-06-05',
    description_clean: 'impact evaluation baseline endline',
    duplicate_key: 'devnetjobsindia|impact-evaluation-rfp|example-foundation|2026-06-05',
    status: 'new',
    overall_score: 75
  });
  const second = store.upsertTender({
    ...first,
    id: undefined,
    description_clean: 'updated description',
    overall_score: 82
  });

  assert.equal(first.id, second.id);
  assert.equal(store.listTenders({}).length, 1);
  assert.equal(store.listTenders({})[0].overall_score, 82);

  const updated = store.updateTenderStatus(first.id, 'shortlisted');
  assert.equal(updated.status, 'shortlisted');
  assert.equal(store.listAuditEvents().length, 1);
});

test('filters tenders by source and fit band', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfp-store-filter-'));
  const store = createStore(path.join(dir, 'test.sqlite'));
  store.init();

  store.upsertTender({
    source_id: 'ngobox',
    source_name: 'NGO Box',
    title: 'Impact Evaluation RFP',
    organization: 'Example NGO',
    duplicate_key: 'ngobox|impact|example|2026',
    overall_score: 82,
    status: 'new'
  });
  store.upsertTender({
    source_id: 'devnetjobsindia',
    source_name: 'DevNetJobsIndia',
    title: 'Vendor RFP',
    organization: 'Example Buyer',
    duplicate_key: 'devnet|vendor|example|2026',
    overall_score: 42,
    status: 'new'
  });

  assert.equal(store.listTenders({ source_id: 'ngobox' }).length, 1);
  assert.equal(store.listTenders({ fit: 'strong' })[0].title, 'Impact Evaluation RFP');
  assert.equal(store.listTenders({ fit: 'low' })[0].title, 'Vendor RFP');
});

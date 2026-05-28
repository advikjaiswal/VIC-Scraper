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
  assert.match(first.tracking_id, /^VIC-RFP-2026-\d{4}$/);
  assert.equal(second.tracking_id, first.tracking_id);
  assert.equal(store.listTenders({}).length, 1);
  assert.equal(store.listTenders({})[0].overall_score, 82);

  const updated = store.updateTenderStatus(first.id, 'shortlisted');
  assert.equal(updated.status, 'shortlisted');
  assert.equal(store.listAuditEvents().length, 1);
});

test('tracks won opportunities for success-fee billing', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfp-store-fee-'));
  const store = createStore(path.join(dir, 'test.sqlite'));
  store.init();

  const tender = store.upsertTender({
    source_id: 'ngobox',
    source_name: 'NGO Box',
    title: 'Baseline Study RFP',
    organization: 'Example NGO',
    deadline: '2026-07-01',
    duplicate_key: 'ngobox|baseline|example|2026',
    overall_score: 80,
    status: 'new'
  });

  store.updateTenderStatus(tender.id, 'shortlisted');
  store.updateTenderStatus(tender.id, 'draft_required');
  store.updateTenderStatus(tender.id, 'draft_generated');
  store.updateTenderStatus(tender.id, 'under_review');
  store.updateTenderStatus(tender.id, 'ready_to_submit');
  store.updateTenderStatus(tender.id, 'submitted');
  const won = store.updateTenderStatus(tender.id, 'won');

  assert.equal(won.status, 'won');
  assert.equal(store.stats().won_count, 1);
  assert.equal(store.stats().success_fee_inr, 2000);
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

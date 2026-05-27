const assert = require('node:assert/strict');
const test = require('node:test');
const { scoreTender, classifyTender } = require('../src/scoring');

test('scores impact evaluation RFPs as strong fit with urgent label', () => {
  const scored = scoreTender({
    title: 'RFP for Impact Evaluation and Endline Study',
    country: 'India',
    deadline: '2026-06-05',
    description_clean: 'Qualified evaluation agencies are invited for a two-phase impact evaluation, baseline and endline study for livelihoods programs.',
    documents: [{ url: 'https://example.org/rfp.pdf' }],
    source_id: 'devnetjobsindia'
  }, { now: new Date('2026-05-26T00:00:00Z') });

  assert.ok(scored.topic_score >= 80);
  assert.ok(scored.geography_score >= 80);
  assert.ok(scored.deadline_score >= 70);
  assert.ok(scored.overall_score >= 70);
  assert.equal(scored.ai_recommendation, 'Strong fit. Review quickly and prepare a proposal decision.');
  assert.ok(scored.labels.includes('strong_fit'));
  assert.ok(scored.labels.includes('urgent'));
});

test('demotes expired or unrelated tenders', () => {
  const scored = scoreTender({
    title: 'Road construction equipment supply',
    country: 'India',
    deadline: '2026-01-01',
    description_clean: 'Supply of construction equipment and road materials.',
    documents: [],
    source_id: 'generic_search'
  }, { now: new Date('2026-05-26T00:00:00Z') });

  assert.equal(classifyTender(scored), 'expired');
  assert.ok(scored.overall_score < 35);
  assert.ok(scored.labels.includes('expired'));
});

test('prioritizes real evaluation language over generic vendor RFPs', () => {
  const now = new Date('2026-05-26T00:00:00Z');
  const impact = scoreTender({
    title: 'RFP - Impact Assessment of the TRANScend Programme (2016-2025)',
    country: 'India',
    deadline: '2026-05-27',
    description_clean: 'Impact assessment assignment for a development programme.',
    documents: []
  }, { now });
  const vendor = scoreTender({
    title: 'RFP - To Onboarding a EAP Vendor',
    country: 'India',
    deadline: '2026-05-26',
    description_clean: 'Vendor onboarding and employee assistance services.',
    documents: []
  }, { now });

  assert.ok(impact.overall_score > vendor.overall_score);
  assert.ok(impact.keywords_matched.includes('impact assessment'));
  assert.ok(impact.labels.includes('strong_fit'));
});

test('baseline assessment and independent research study are strong proposal candidates', () => {
  const now = new Date('2026-05-26T00:00:00Z');
  const baseline = scoreTender({
    title: 'RFP - Baseline Assessment for Effectiveness of Samasta Application',
    country: 'India',
    deadline: '2026-05-30',
    description_clean: 'Baseline assessment for effectiveness, research design and data collection.',
    documents: []
  }, { now });
  const research = scoreTender({
    title: 'RFP - Three-Year Independent Research Study - Open Books, Open minds',
    country: 'India',
    deadline: null,
    description_clean: 'Independent research study for a gender responsive reading program.',
    documents: []
  }, { now });

  assert.ok(baseline.overall_score >= 70);
  assert.ok(research.overall_score >= 60);
});

const assert = require('node:assert/strict');
const test = require('node:test');
const { tendersToCsv } = require('../src/exporters');

test('exports tender tracker rows as CSV with escaped values', () => {
  const csv = tendersToCsv([
    {
      id: 't1',
      title: 'Impact Evaluation, Round 1',
      organization: 'Example "Foundation"',
      source_name: 'NGO Box',
      country: 'India',
      deadline: '2026-06-05',
      status: 'shortlisted',
      overall_score: 88,
      detail_url: 'https://example.org/rfp'
    }
  ]);

  assert.match(csv, /^id,title,organization/);
  assert.match(csv, /"Impact Evaluation, Round 1"/);
  assert.match(csv, /"Example ""Foundation"""/);
});

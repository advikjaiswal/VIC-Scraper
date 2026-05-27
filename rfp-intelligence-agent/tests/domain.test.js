const assert = require('node:assert/strict');
const test = require('node:test');
const {
  normalizeTender,
  duplicateKey,
  parseDeadline,
  canTransitionStatus,
  TENDER_STATUSES
} = require('../src/domain');

test('normalizes tender fields and builds stable duplicate key', () => {
  const tender = normalizeTender({
    source_id: 'devnetjobsindia',
    source_name: 'DevNetJobsIndia',
    title: '  Two-phase Impact Evaluation of Livelihood Programs ',
    organization: ' Example Foundation ',
    deadline: '5th June 2026',
    description_raw: 'Baseline, endline and MEL assignment'
  });

  assert.equal(tender.title, 'Two-phase Impact Evaluation of Livelihood Programs');
  assert.equal(tender.organization, 'Example Foundation');
  assert.equal(tender.deadline, '2026-06-05');
  assert.equal(
    tender.duplicate_key,
    duplicateKey({
      source_id: 'devnetjobsindia',
      title: 'two phase impact evaluation of livelihood programs',
      organization: 'example foundation',
      deadline: '2026-06-05'
    })
  );
  assert.equal(tender.status, 'new');
});

test('parses common Indian and ISO deadline formats', () => {
  assert.equal(parseDeadline('Proposal deadline: 5th June 2026'), '2026-06-05');
  assert.equal(parseDeadline('Apply by 05/06/2026'), '2026-06-05');
  assert.equal(parseDeadline('2026-06-05'), '2026-06-05');
  assert.equal(parseDeadline('no date here'), null);
});

test('guards status transitions that would skip human review', () => {
  assert.ok(TENDER_STATUSES.includes('ready_to_submit'));
  assert.equal(canTransitionStatus('new', 'shortlisted'), true);
  assert.equal(canTransitionStatus('draft_generated', 'under_review'), true);
  assert.equal(canTransitionStatus('new', 'submitted'), false);
  assert.equal(canTransitionStatus('ready_to_submit', 'submitted'), true);
});

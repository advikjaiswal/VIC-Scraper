const assert = require('node:assert/strict');
const test = require('node:test');
const { buildActions } = require('../src/actions');

test('builds practical actions for high-fit and missing-doc opportunities', () => {
  const actions = buildActions([
    {
      id: 't1',
      title: 'Impact Evaluation RFP',
      deadline: '2026-06-05',
      status: 'new',
      overall_score: 83,
      document_availability_score: 88,
      next_action: 'Shortlist and generate proposal pack'
    },
    {
      id: 't2',
      title: 'CSR Research EOI',
      deadline: '2026-06-18',
      status: 'new',
      overall_score: 75,
      document_availability_score: 35,
      next_action: 'Find or upload tender document'
    },
    {
      id: 't3',
      title: 'Low fit supply tender',
      status: 'new',
      overall_score: 20
    }
  ], { now: new Date('2026-05-26T00:00:00Z') });

  assert.ok(actions.some(action => action.type === 'review_rfp' && action.tender_id === 't1'));
  assert.ok(actions.some(action => action.type === 'generate_draft' && action.tender_id === 't1'));
  assert.ok(actions.some(action => action.type === 'missing_document' && action.tender_id === 't2'));
  assert.ok(actions.every(action => action.tender_id !== 't3'));
});

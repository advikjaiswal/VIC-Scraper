const assert = require('node:assert/strict');
const test = require('node:test');
const { generateTemplateProposal } = require('../src/proposals');

test('generates template proposal pack with placeholders for missing credentials', () => {
  const draft = generateTemplateProposal({
    tender: {
      id: 't1',
      tracking_id: 'VIC-RFP-2026-0007',
      title: 'Impact Evaluation of Education Program',
      organization: 'Example NGO',
      deadline: '2026-06-05',
      description_clean: 'Two-phase impact evaluation with baseline and endline data collection.'
    },
    clientProfile: {
      organization_name: 'Client Research Team',
      sectors: ['education', 'livelihoods']
    }
  });

  assert.match(draft.markdown, /Client Research Team/);
  assert.match(draft.markdown, /VIC-RFP-2026-0007/);
  assert.match(draft.title, /VIC-RFP-2026-0007/);
  assert.match(draft.markdown, /\[INSERT RELEVANT PROJECT EXPERIENCE\]/);
  assert.match(draft.markdown, /Compliance Matrix/);
  assert.match(draft.markdown, /Technical Methodology/);
  assert.match(draft.markdown, /Quality Assurance/);
  assert.match(draft.markdown, /Go \/ No-Go Recommendation/);
  assert.ok(draft.needs_human_input.length >= 3);
  assert.equal(draft.confidence_score < 80, true);
});

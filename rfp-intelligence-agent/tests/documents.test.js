const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { extractTextFromFile, analyzeRfpText } = require('../src/documents');

test('extracts text files and detects RFP requirements', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfp-doc-'));
  const file = path.join(dir, 'sample-rfp.txt');
  fs.writeFileSync(file, `
    Proposal deadline: 5th June 2026.
    Eligibility: qualified evaluation agencies with five years experience.
    Submission: email technical and financial proposal to procurement@example.org.
    Scope of work: baseline survey, endline evaluation, data collection and final report.
    Deliverables: inception report, tools, draft report, final report.
    Evaluation criteria: technical quality 70%, financial 30%.
  `);

  const text = extractTextFromFile(file);
  const analysis = analyzeRfpText(text);

  assert.match(text, /baseline survey/);
  assert.equal(analysis.deadline, '2026-06-05');
  assert.match(analysis.eligibility, /qualified evaluation agencies/);
  assert.match(analysis.submission_instructions, /procurement@example.org/);
  assert.ok(analysis.required_documents.includes('technical proposal'));
  assert.ok(analysis.scope_of_work.includes('baseline survey'));
  assert.ok(analysis.deliverables.includes('final report'));
});

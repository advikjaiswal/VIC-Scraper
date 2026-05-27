const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { exportProposalDraft } = require('../src/proposalExport');

test('exports proposal draft markdown to a stable file', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'rfp-export-'));
  const result = exportProposalDraft({
    id: 'draft1',
    title: 'Proposal Draft - Impact Evaluation',
    markdown: '# Proposal\n\nHuman review required.'
  }, dir, { docx: false });

  assert.ok(fs.existsSync(result.markdownPath));
  assert.match(fs.readFileSync(result.markdownPath, 'utf8'), /Human review required/);
});

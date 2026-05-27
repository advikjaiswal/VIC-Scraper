const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const path = require('node:path');
const { slug } = require('./domain');

function exportProposalDraft(draft, outputDir, options = {}) {
  fs.mkdirSync(outputDir, { recursive: true });
  const baseName = slug(draft.title || draft.id || 'proposal-draft') || 'proposal-draft';
  const markdownPath = path.join(outputDir, `${baseName}.md`);
  fs.writeFileSync(markdownPath, draft.markdown || '', 'utf8');

  const result = { markdownPath, docxPath: null };
  if (options.docx !== false) {
    const docxPath = path.join(outputDir, `${baseName}.docx`);
    execFileSync('pandoc', [markdownPath, '-o', docxPath], { stdio: 'ignore' });
    result.docxPath = docxPath;
  }
  return result;
}

module.exports = { exportProposalDraft };

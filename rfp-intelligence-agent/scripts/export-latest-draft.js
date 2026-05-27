const path = require('node:path');
const config = require('../src/config');
const { createStore } = require('../src/storage');
const { exportProposalDraft } = require('../src/proposalExport');

const store = createStore(config.dbPath);
store.init();
const draft = store.listProposalDrafts()[0];
if (!draft) {
  console.error('No proposal drafts found. Generate a draft first.');
  process.exit(1);
}

const outputDir = path.join(config.rootDir, 'exports');
const result = exportProposalDraft(draft, outputDir);
console.log(JSON.stringify(result, null, 2));

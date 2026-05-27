const { execFileSync } = require('node:child_process');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { parseDeadline, cleanText } = require('./domain');

function commandExists(command) {
  try {
    execFileSync('which', [command], { stdio: 'ignore' });
    return true;
  } catch (_) {
    return false;
  }
}

function stripHtml(value) {
  return cleanText(String(value || '').replace(/<script[\s\S]*?<\/script>/gi, ' ').replace(/<style[\s\S]*?<\/style>/gi, ' ').replace(/<[^>]+>/g, ' '));
}

function extractTextFromFile(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (['.txt', '.md', '.csv'].includes(ext)) return fs.readFileSync(filePath, 'utf8');
  if (['.html', '.htm'].includes(ext)) return stripHtml(fs.readFileSync(filePath, 'utf8'));
  if (ext === '.pdf') return execFileSync('pdftotext', ['-layout', filePath, '-'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  if (['.doc', '.docx', '.rtf'].includes(ext)) {
    if (commandExists('textutil')) {
      return execFileSync('textutil', ['-convert', 'txt', '-stdout', filePath], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    }
    if (commandExists('pandoc')) {
      return execFileSync('pandoc', [filePath, '-t', 'plain'], { encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
    }
    throw new Error('DOC/DOCX extraction requires textutil or pandoc');
  }
  throw new Error(`Unsupported document type: ${ext || 'unknown'}`);
}

function sentenceContaining(text, patterns) {
  const sentences = String(text || '').split(/(?<=[.?!])\s+|\n+/).map(cleanText).filter(Boolean);
  return sentences.find(sentence => patterns.some(pattern => pattern.test(sentence))) || '';
}

function collectTerms(text, terms) {
  const lower = String(text || '').toLowerCase();
  return terms.filter(term => lower.includes(term));
}

function analyzeRfpText(text) {
  const cleaned = cleanText(text);
  const required = collectTerms(cleaned, [
    'technical proposal',
    'financial proposal',
    'organization profile',
    'company profile',
    'team cv',
    'cvs',
    'registration certificate',
    'tax certificate',
    'work plan'
  ]);
  const lower = cleaned.toLowerCase();
  if (lower.includes('technical') && lower.includes('proposal') && !required.includes('technical proposal')) required.push('technical proposal');
  if (lower.includes('financial') && lower.includes('proposal') && !required.includes('financial proposal')) required.push('financial proposal');

  return {
    deadline: parseDeadline(cleaned),
    eligibility: sentenceContaining(cleaned, [/eligib/i, /qualified/i, /experience/i]),
    submission_instructions: sentenceContaining(cleaned, [/submission/i, /submit/i, /email/i, /portal/i]),
    required_documents: required,
    evaluation_criteria: sentenceContaining(cleaned, [/evaluation criteria/i, /technical quality/i, /financial/i]),
    scope_of_work: sentenceContaining(cleaned, [/scope of work/i, /baseline/i, /endline/i, /data collection/i]),
    deliverables: sentenceContaining(cleaned, [/deliverables/i, /inception report/i, /final report/i]),
    summary: cleaned.slice(0, 1200)
  };
}

function saveUploadedDocument({ store, tenderId, filePath, url = '' }) {
  const parsedText = extractTextFromFile(filePath);
  const analysis = analyzeRfpText(parsedText);
  return store.saveTenderDocument({
    tender_id: tenderId,
    url,
    filename: path.basename(filePath),
    content_type: path.extname(filePath).slice(1).toLowerCase(),
    parsed_text: parsedText,
    summary: JSON.stringify(analysis)
  });
}

module.exports = { extractTextFromFile, analyzeRfpText, saveUploadedDocument, commandExists };

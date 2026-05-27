const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const test = require('node:test');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

test('client-facing dashboard does not expose demo or phase language', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8').toLowerCase();
  assert.equal(html.includes('seed demo'), false);
  assert.equal(html.includes('phase 1'), false);
  assert.equal(html.includes('mvp'), false);
});

test('README presents the app as a launchable product', () => {
  const readme = fs.readFileSync(path.join(root, 'README.md'), 'utf8').toLowerCase();
  assert.equal(readme.includes('demo data'), false);
  assert.equal(readme.includes('phase 2 is in progress'), false);
  assert.match(readme, /production launch/i);
});

test('dashboard inline script is syntactically valid', () => {
  const html = fs.readFileSync(path.join(root, 'public', 'index.html'), 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/gi)].map(match => match[1]);
  assert.ok(scripts.length > 0);
  for (const script of scripts) {
    assert.doesNotThrow(() => new vm.Script(script));
  }
});

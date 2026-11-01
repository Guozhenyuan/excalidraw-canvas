import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
const html = await readFile(new URL('../index.html', import.meta.url), 'utf8');
const csp = html.match(/http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
const rules = Object.fromEntries(csp.split(';').filter(value => value.trim()).map(value => { const [key, ...sources] = value.trim().split(/\s+/); return [key, sources]; }));
test('production CSP permits the official library download paths alongside GitHub API', () => {
  assert.deepEqual(rules['connect-src'], ["'self'", 'https://api.github.com', 'https://libraries.excalidraw.com/libraries/', 'https://raw.githubusercontent.com/excalidraw/excalidraw-libraries/']);
});
test('library downloads do not permit third-party scripts, frames or wildcard connections', () => {
  assert.deepEqual(rules['script-src'], ["'self'"]);
  assert.deepEqual(rules['frame-src'], ["'none'"]);
  assert.deepEqual(rules['object-src'], ["'none'"]);
  assert.ok(rules['connect-src'].every(source => !source.includes('*') && source !== 'https:'));
});

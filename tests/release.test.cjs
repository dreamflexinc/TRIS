'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const read = file => fs.readFileSync(path.join(root, file), 'utf8');
const original = read('TRIScore4_1_ManifoldAtlas.html');
const result = read('TRIScore4_3_InfernoLab.html');
const scripts = html => [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
test('every retained 4.1 JavaScript module is byte-identical and in the same order', () => {
  const before = scripts(original), after = scripts(result);
  assert.equal(after.length, before.length + 5);
  assert.deepEqual(after.slice(1, before.length + 1), before);
});
test('Color Studio and Graph Studio controls, all page routes and original CSS remain present', () => {
  const originalStyle = [...original.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]);
  const resultStyle = [...result.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1]);
  originalStyle.forEach((style, i) => assert(resultStyle[i].startsWith(style)));
  const ids = html => [...html.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]);
  const newIds = new Set(ids(result));
  for (const id of ids(original)) assert(newIds.has(id), 'Missing original control: ' + id);
  for (const text of ['Build series from theme', 'Export graph colors', 'Pure black background in dark mode', 'Goblin violet', 'Graphite']) assert(result.includes(text), text);
  assert.equal(ids(result).length, newIds.size, 'HTML IDs must be unique');
  assert(result.includes('id="origins"'));
  assert(result.includes('data-go="origins"'));
});
test('strict content policy contains exact hashes of every embedded script and style', () => {
  const policy = result.match(/<meta http-equiv="Content-Security-Policy" content="([^"]+)"/)[1];
  for (const text of [...scripts(result), ...[...result.matchAll(/<style>([\s\S]*?)<\/style>/g)].map(m => m[1])]) {
    assert(!text.includes('\r'), 'Hashes must use browser-normalized line endings');
    const hash = crypto.createHash('sha256').update(text).digest('base64');
    assert(policy.includes("'sha256-" + hash + "'"));
  }
  assert(!policy.includes('unsafe-inline'));
  assert(policy.includes("connect-src 'none'"));
});
test('release manifest hashes match the shipped entry and unmodified parent', () => {
  const manifest = JSON.parse(read('BUILD-MANIFEST.json'));
  const sha = text => crypto.createHash('sha256').update(text).digest('hex');
  assert.equal(manifest.htmlSha256, sha(result));
  assert.equal(manifest.baseSha256, sha(original));
  assert.equal(manifest.parentSha256, sha(read('TRIScore4_2_CosmicOrigins.html')));
  assert.equal(manifest.release, '4.3.3');
});

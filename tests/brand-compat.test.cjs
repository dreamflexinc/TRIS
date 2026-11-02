'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), crypto = require('node:crypto');
const B = require('../src/brand-compat.js'), A = require('../src/atlas-core.js'), O = require('../src/origins-core.js');
const previous = B.legacyName(), PASS = 'a separate compatibility testing passphrase';
const html = fs.readFileSync(path.join(__dirname, '../TRIScore4_1_ManifoldAtlas.html'), 'utf8');
const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);

function contracts() {
  const ctx = vm.createContext({ crypto: crypto.webcrypto, TextEncoder, TextDecoder, btoa, atob,
    TRIScoreBrandCompat: B, isSecureContext: true });
  ctx.window = ctx;
  // Run only pure model contracts, never the app UI or a real browser profile.
  for (const index of [4, 5, 6, 9, 11, 21, 22, 24]) vm.runInContext(scripts[index], ctx, { timeout: 10000 });
  return ctx;
}

test('storage aliases read/write/delete the same physical record, without JSON rewriting or copies', () => {
  class FakeStorage {
    constructor() { this.data = new Map(); }
    getItem(key) { return this.data.get(String(key)) ?? null; }
    setItem(key, value) { this.data.set(String(key), String(value)); }
    removeItem(key) { this.data.delete(String(key)); }
    key(index) { return [...this.data.keys()][index] ?? null; }
  }
  const s = new FakeStorage(), logical = 'triscore-sentinel-vault-v1', physical = previous + '-sentinel-vault-v1';
  const cipher = JSON.stringify({ schema: B.legacyProtocol('triscore.vault.v1'), data: 'OPAQUE+AUTHENTICATED' });
  s.setItem(physical, cipher); assert(B.installStorage(FakeStorage.prototype));
  assert.equal(s.getItem(logical), cipher); assert.equal(s.data.size, 1); assert.equal(s.key(0), logical);
  s.setItem(logical, cipher + ' '); assert.equal(s.data.get(physical), cipher + ' '); assert.equal(s.data.size, 1);
  s.data.set(physical, 'concurrent writer'); assert.equal(s.getItem(logical), 'concurrent writer');
  s.removeItem(logical); assert.equal(s.getItem(logical), null); assert.equal(s.data.size, 0);
  assert(B.installStorage(FakeStorage.prototype)); assert.equal(s.getItem(logical), null);
});

test('only exact known storage keys and protocol identifiers are aliased', () => {
  assert.equal(B.physicalStorageKey('triscore-inferno-origins-v2'), previous + '-inferno-origins-v2');
  assert.equal(B.physicalStorageKey('goblin.appearance.v5'), 'goblin.appearance.v5');
  assert.equal(B.physicalStorageKey('triscore-unrelated-private-note'), 'triscore-unrelated-private-note');
  assert.equal(B.canonicalProtocol(previous + '.origins.library.v1'), 'triscore.origins.library.v1');
  assert.equal(B.canonicalProtocol('A user note about ' + previous), 'A user note about ' + previous);
  assert(!B.isProtocol('other.origins.library.v1', 'triscore.origins.library.v1'));
  assert.equal(B.databaseName('triscore-tris-native'), previous + '-tris-native');
  assert.equal(B.databaseName('other-database'), 'other-database');
});

test('real legacy Sentinel ciphertext decrypts using original authenticated schema; future saves use new schemas', async () => {
  const ctx = contracts(), S = ctx.TRIScoreSecurity;
  const salt = crypto.randomBytes(32), iv = crypto.randomBytes(12);
  const e = { schema: B.legacyProtocol(S.SCHEMA), cipher: 'AES-256-GCM', kdf: 'PBKDF2-HMAC-SHA256',
    iterations: S.ITERATIONS, salt: salt.toString('base64'), iv: iv.toString('base64'), data: '' };
  const key = crypto.pbkdf2Sync(PASS, salt, S.ITERATIONS, 32, 'sha256');
  const plain = { schema: B.legacyProtocol(S.PAYLOAD), title: 'A preserved notebook', text: 'Untouched private text.' };
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(JSON.stringify({ schema: e.schema, cipher: e.cipher, kdf: e.kdf, iterations: e.iterations, salt: e.salt })));
  e.data = Buffer.concat([cipher.update(JSON.stringify(plain)), cipher.final(), cipher.getAuthTag()]).toString('base64');
  const original = JSON.stringify(e), unlocked = await S.open(original, PASS);
  assert.equal(unlocked.doc.schema, S.PAYLOAD); assert.equal(unlocked.doc.text, plain.text);
  assert.equal(JSON.stringify(e), original);
  const saved = await S.seal(unlocked.key, unlocked.envelope, unlocked.doc);
  assert.equal(saved.schema, S.SCHEMA); assert.equal((await S.open(saved, PASS)).doc.schema, S.PAYLOAD);
  await assert.rejects(S.open({ ...e, schema: S.SCHEMA }, PASS), /incorrect|damaged/i);
});

test('legacy science capsule verifies original checksum before adapting source and nested recipe schemas', async () => {
  const ctx = contracts();
  const raw = await vm.runInContext(`(async()=>{
    const B=TRIScoreBrandCompat,X=TRIScoreConvergence,A=TRIScoreAccelerator;
    const recipe=A.recipe(A.DEFAULT);recipe.schema=B.legacyProtocol(recipe.schema);
    const payload={schema:B.legacyProtocol(X.PAYLOAD),title:'Original science',created_at:'2026-10-30T12:00:00.000Z',
      source:B.legacyProtocol(X.APP),components:[{kind:'collider',data:recipe}]};
    return JSON.stringify({schema:B.legacyProtocol(X.SCHEMA),payload,sha256:await TRIScoreSecurity.sha256(X.canonical(payload))});
  })()`, ctx);
  const X = ctx.TRIScoreConvergence, verified = await X.verify(raw), encoded = X.encode(verified);
  assert.equal(verified.schema, X.SCHEMA); assert.equal(verified.payload.schema, X.PAYLOAD);
  assert.equal(verified.payload.source, X.APP);
  assert.equal(verified.payload.components[0].data.schema, ctx.TRIScoreAccelerator.SCHEMA);
  assert(!encoded.includes(previous)); await X.verify(encoded);
  const modified = JSON.parse(raw); modified.payload.title = 'Modified after signing';
  await assert.rejects(X.verify(JSON.stringify(modified)), /digest mismatch/i);
});

test('legacy Collider and Frontier recipes read successfully and export current formats', () => {
  const ctx = contracts();
  vm.runInContext(`{
    const A=TRIScoreAccelerator,F=TRIScoreFrontier,B=TRIScoreBrandCompat;
    const a=A.recipe(A.DEFAULT);a.schema=B.legacyProtocol(a.schema);
    if(A.parse(JSON.stringify(a)).schema!==A.SCHEMA)throw Error('Collider alias failed');
    const f=F.recipe('bell',F.DEFAULT.bell);f.schema=B.legacyProtocol(f.schema);
    if(F.parse(JSON.stringify(f)).schema!==F.SCHEMA)throw Error('Frontier alias failed');
  }`, ctx);
});

test('old Origins v1 and v2 state schemas restore exact concentration fields and clocks', () => {
  const sim = O.create({ ...O.defaults('soup'), grid: 40 }); O.interact(sim, { type: 'zap' }); O.step(sim, 0.143);
  const current = O.snapshot(sim), legacy = { ...current, schema: B.legacyProtocol(current.schema) };
  const restored = O.snapshot(O.restore(legacy));
  assert.equal(restored.schema, O.SCHEMA); assert.equal(restored.U, legacy.U); assert.equal(restored.V, legacy.V);
  assert.equal(restored.time, legacy.time); assert.deepEqual(restored.beads, legacy.beads);
  const v1 = { ...current, schema: B.legacyProtocol(O.LEGACY_SCHEMA) };
  const migrated = O.snapshot(O.restore(v1));
  assert.equal(migrated.U, v1.U); assert.equal(migrated.V, v1.V); assert.equal(migrated.time, v1.time);
  assert.equal(migrated.zapCount, 0);
});

test('old Atlas schema preserves records and emits a current library schema', () => {
  const record = { id: 'a-view', kind: 'view', title: 'A remembered view', note: 'Unchanged note',
    createdAt: '2026-10-30T12:00:00.000Z', config: A.defaults() };
  const original = { schema: B.legacyProtocol(A.SCHEMA), records: [record] };
  const value = A.parse(JSON.stringify(original));
  assert.equal(value.schema, A.SCHEMA); assert.deepEqual(value.records, [record]);
  assert.equal(original.schema, B.legacyProtocol(A.SCHEMA));
});

test('Tris IndexedDB adapter opens the existing physical database while retaining opaque vault data', async () => {
  let opened;
  const db = {}, ctx = vm.createContext({ TRIScoreBrandCompat: B, indexedDB: { open(name) {
    opened = name; const request = { result: db }; queueMicrotask(() => request.onsuccess()); return request;
  } } });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../src/tris-browser-store.js'), 'utf8'), ctx);
  const store = new ctx.TrisBrowserStore(); await store.open();
  assert.equal(opened, previous + '-tris-native');
});

test('service-ID labels are view-only and do not alter encrypted permission or audit inputs', () => {
  const state = { permissions: { [previous + '.console']: ['identity:read'] },
    audit: [{ actor: previous + '.console', target: previous + '.sentinel', hash: 'unchanged' }] };
  const raw = JSON.stringify(state), label = B.displayId(state.audit[0].actor);
  assert.equal(label, 'triscore.console'); assert.equal(JSON.stringify(state), raw);
});

test('shipping compatibility source contains no previous product-name literal', () => {
  for (const name of ['../src/brand-compat.js', '../src/origins-core.js', '../src/atlas-core.js', '../TRIScore4_1_ManifoldAtlas.html']) {
    assert(!fs.readFileSync(path.join(__dirname, name), 'utf8').toLowerCase().includes(previous));
  }
});

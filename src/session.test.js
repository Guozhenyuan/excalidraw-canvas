import test from 'node:test';
import assert from 'node:assert/strict';
import { validConnection, normalizeConnection, readConnection, rememberConnection, forgetConnection } from './session.js';
const expected = { owner: 'Guozhenyuan', repo: 'excalidraw-drawings', branch: 'main' };
const credentials = { ...expected, token: 'github_pat_TEST_ONLY' };
const saved = { ...credentials, retention: 'until-sign-out', expiresAt: null };

test('remembered connection has no local expiry and is bound to its exact repository and branch', () => {
  assert.equal(validConnection(saved, expected), true);
  for (const key of ['owner', 'repo', 'branch']) assert.equal(validConnection(saved, { ...expected, [key]: 'other' }), false);
});
test('old local deadlines migrate without altering credentials, including elapsed deadlines', () => {
  for (const expiresAt of [1, Date.now() + 86400000]) {
    assert.deepEqual(normalizeConnection({ ...credentials, expiresAt }, expected), saved);
  }
});
test('missing or malformed records never connect', () => {
  for (const candidate of [null, {}, credentials, { ...saved, token: 'wrong' }, { ...saved, token: 'github_pat_' },
    { ...credentials, expiresAt: Infinity }, { ...credentials, expiresAt: 0 },
    { ...saved, expiresAt: 2000 }, { ...saved, retention: 'unknown' }]) {
    assert.equal(validConnection(candidate, expected), false);
  }
});

// Exercise the IndexedDB adapter's read/write/delete flow without real credentials.
function mockDatabase(initial) {
  let current = initial;
  return {
    current: () => current,
    open() {
      const request = {};
      queueMicrotask(() => {
        request.result = {
          close() {},
          transaction() {
            const tx = {
              objectStore: () => ({
                get: () => ({ result: current }),
                put: value => { current = structuredClone(value); return { result: 'current' }; },
                delete: () => { current = undefined; return { result: undefined }; }
              })
            };
            queueMicrotask(() => tx.oncomplete());
            return tx;
          }
        };
        request.onsuccess();
      });
      return request;
    }
  };
}
test('migration persists, reload restores, and explicit logout removes the connection', async t => {
  const db = mockDatabase({ ...credentials, expiresAt: 1 });
  const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: db });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'indexedDB', original); else delete globalThis.indexedDB; });
  assert.equal(await readConnection({ ...expected, repo: 'other' }), null);
  assert.equal(db.current().expiresAt, 1);
  assert.deepEqual(await readConnection(expected), saved);
  assert.deepEqual(db.current(), saved);
  assert.deepEqual(await readConnection(expected), saved);
  await forgetConnection();
  assert.equal(await readConnection(expected), null);
  await rememberConnection(credentials);
  assert.deepEqual(db.current(), saved);
  assert.deepEqual(await readConnection(expected), saved);
  await assert.rejects(rememberConnection({ ...credentials, token: '' }));
  assert.deepEqual(db.current(), saved);
});

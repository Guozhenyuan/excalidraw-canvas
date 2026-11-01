import test from 'node:test';
import assert from 'node:assert/strict';
import { libraryReturnURL, libraryStartupURL, mergeLibraryById, libraryStore } from './library.js';
import { readRoute, canvasURL } from './routing.js';
const base = 'https://guozhenyuan.github.io/excalidraw-canvas/';
const route = { file: '项目 & 草稿/数据 %25.excalidraw', owner: 'another-owner', repo: 'private-art', branch: 'draft/art', readonly: true };
const drawing = canvasURL(base, route);
const source = 'https://libraries.excalidraw.com/libraries/lipis/stars.excalidrawlib';
test('catalogue referrer is encoded as one parameter and preserves the complete canvas route', () => {
  const browse = new URL(`https://libraries.excalidraw.com/?target=privatecanvasTEST&referrer=${libraryReturnURL(drawing)}&useHash=true&token=editorID`);
  assert.equal(browse.searchParams.get('referrer'), drawing);
  assert.deepEqual(readRoute(browse.searchParams.get('referrer')), route);
  assert.equal(browse.searchParams.get('branch'), null);
});
test('initial return keeps library callback until import and removes unrelated secrets', () => {
  const url = drawing + '&access_token=SECRET#' + new URLSearchParams({ addLibrary: source, token: 'editorID', unrelated: 'SECRET' });
  const clean = new URL(libraryStartupURL(url));
  assert.deepEqual(readRoute(clean), route);
  assert.equal(new URLSearchParams(clean.hash.slice(1)).get('addLibrary'), source);
  assert.equal(new URLSearchParams(clean.hash.slice(1)).get('token'), 'editorID');
  assert.ok(!clean.href.includes('SECRET'));
  assert.equal(libraryReturnURL(url), encodeURIComponent(drawing));
});
test('legacy query callbacks become hash callbacks without leaking a GitHub credential', () => {
  const url = new URL(drawing); url.searchParams.set('addLibrary', source); url.hash = 'token=github_pat_TEST_ONLY';
  const clean = new URL(libraryStartupURL(url.href));
  assert.equal(clean.searchParams.get('addLibrary'), null);
  assert.equal(new URLSearchParams(clean.hash.slice(1)).get('addLibrary'), source);
  assert.equal(new URLSearchParams(clean.hash.slice(1)).get('token'), null);
  assert.equal(libraryStartupURL(drawing + '#unrelated'), drawing);
});
test('seeding built-in items preserves saved custom items and normalized existing items', () => {
  const saved = [{ id: 'builtin-1', elements: [{ versionNonce: 42 }] }, { id: 'custom-1' }];
  const bundled = [{ id: 'builtin-1', elements: [{}] }, { id: 'builtin-2' }];
  assert.deepEqual(mergeLibraryById(saved, bundled), [bundled[1], ...saved]);
});
test('library storage reloads additions and deletions separately from connection credentials', async t => {
  let saved; const original = Object.getOwnPropertyDescriptor(globalThis, 'indexedDB');
  const fake = { open(name) {
    assert.equal(name, 'private-canvas-library-v1');
    const request = {};
    queueMicrotask(() => {
      request.result = { close() {}, transaction() {
        const tx = { objectStore: () => ({ get: () => ({ result: structuredClone(saved) }), put: value => { saved = structuredClone(value); return { result: 'current' }; } }) };
        queueMicrotask(() => tx.oncomplete()); return tx;
      } };
      request.onsuccess();
    }); return request;
  } };
  Object.defineProperty(globalThis, 'indexedDB', { configurable: true, value: fake });
  t.after(() => { if (original) Object.defineProperty(globalThis, 'indexedDB', original); else delete globalThis.indexedDB; });
  assert.deepEqual(await libraryStore.load(), { libraryItems: [] });
  await libraryStore.save({ libraryItems: [{ id: 'new-library-item' }] });
  assert.deepEqual(await libraryStore.load(), { libraryItems: [{ id: 'new-library-item' }] });
  await libraryStore.save({ libraryItems: [] });
  assert.deepEqual(await libraryStore.load(), { libraryItems: [] });
});

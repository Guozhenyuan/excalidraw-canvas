import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { dataVizItems, installDataViz } from './dataViz.js';
const source = JSON.parse(await readFile(new URL('../public/libraries/data-viz.excalidrawlib', import.meta.url), 'utf8'));
test('bundled official Data Viz contains 32 editable items with stable unique IDs', () => {
  const items = dataVizItems(source);
  assert.equal(items.length, 32);
  assert.equal(new Set(items.map(item => item.id)).size, 32);
  assert.deepEqual(items, dataVizItems(source));
  assert.deepEqual(items.map(item => item.elements), source.library);
  assert.ok(items.every(item => item.status === 'published'));
});
test('invalid or incomplete library files are rejected', () => {
  for (const data of [null, {}, { ...source, library: [] }, { ...source, library: [[]] }, { ...source, library: [[{}]] }]) assert.throws(() => dataVizItems(data));
});
test('repeated installation preserves existing items and does not duplicate restored legacy elements', async () => {
  const personal = { id: 'my-own-item', elements: [{ id: 'my-shape', type: 'rectangle' }] };
  let library = [personal]; const calls = [];
  const api = { updateLibrary: async options => {
    calls.push(options);
    library = options.libraryItems(library).map(item => ({ ...item, elements: item.elements.map(element => ({ ...element, versionNonce: 999 })) }));
    return library;
  } };
  const items = dataVizItems(source);
  await installDataViz(api, items);
  const restored = structuredClone(library);
  await installDataViz(api, items, true);
  assert.equal(library.length, 33);
  assert.deepEqual(library, restored);
  assert.equal(library.at(-1).id, personal.id);
  assert.deepEqual(calls.map(({ merge, prompt, openLibraryMenu }) => ({ merge, prompt, openLibraryMenu })), [
    { merge: false, prompt: false, openLibraryMenu: false }, { merge: false, prompt: false, openLibraryMenu: true }
  ]);
});

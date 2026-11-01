import { canvasURL, readRoute } from './routing.js';

export function libraryReturnURL(href) {
  // Excalidraw 0.18 interpolates this prop directly into a referrer query value.
  return encodeURIComponent(canvasURL(href, readRoute(href)));
}
export function libraryStartupURL(href) {
  const url = new URL(href), hash = new URLSearchParams(url.hash.slice(1));
  const source = hash.get('addLibrary') || url.searchParams.get('addLibrary');
  const clean = new URL(canvasURL(href, readRoute(href)));
  if (source) {
    // Keep the import until useHandleLibrary consumes it; never retain unrelated
    // query parameters (including credentials). The token is an editor instance ID.
    const request = new URLSearchParams({ addLibrary: source });
    const token = hash.get('token');
    if (token && /^[\w-]{1,128}$/.test(token) && !/^(github_pat_|ghp_)/.test(token)) request.set('token', token);
    clean.hash = request.toString();
  }
  return clean.href;
}
export function mergeLibraryById(existing, incoming) {
  const ids = new Set(existing.map(item => item.id));
  return [...incoming.filter(item => !ids.has(item.id)), ...existing];
}

const DATABASE = 'private-canvas-library-v1', STORE = 'library';
async function access(mode, action) {
  if (typeof indexedDB === 'undefined') throw new Error('浏览器不支持保存素材库。');
  const db = await new Promise((resolve, reject) => {
    const request = indexedDB.open(DATABASE, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error('无法打开本机素材库。'));
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode), request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error('无法保存本机素材库。'));
    });
  } finally { db.close(); }
}
export const libraryStore = {
  async load() { return (await access('readonly', store => store.get('current'))) || { libraryItems: [] }; },
  async save(data) { await access('readwrite', store => store.put(data, 'current')); }
};

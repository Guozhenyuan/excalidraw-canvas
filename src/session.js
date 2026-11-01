const DATABASE = 'private-canvas-connection-v1';
const STORE = 'connection';
export const REMEMBER_DAYS = 30;
export function validConnection(record, expected, now = Date.now()) {
  return !!record && typeof record.token === 'string' && record.token.startsWith('github_pat_') &&
    Number.isFinite(record.expiresAt) && record.expiresAt > now &&
    ['owner', 'repo', 'branch'].every(key => record[key] === expected[key]);
}
async function access(mode, action) {
  if (typeof indexedDB === 'undefined') throw new Error('此浏览器不支持记住连接。');
  const db = await new Promise((resolve, reject) => {
    const req = indexedDB.open(DATABASE, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new Error('浏览器阻止了本机存储，可使用本次连接。'));
  });
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode); const request = action(tx.objectStore(STORE));
      tx.oncomplete = () => resolve(request.result);
      tx.onerror = tx.onabort = () => reject(new Error('无法访问本机连接记录，可使用本次连接。'));
    });
  } finally { db.close(); }
}
export async function readConnection(expected) {
  const record = await access('readonly', store => store.get('current'));
  if (!record) return null;
  if (record.expiresAt <= Date.now()) { await forgetConnection(); return null; }
  return validConnection(record, expected) ? record : null;
}
export async function rememberConnection(connection) {
  const record = { ...connection, expiresAt: Date.now() + REMEMBER_DAYS * 86400000 };
  await access('readwrite', store => store.put(record, 'current'));
}
export async function forgetConnection() { await access('readwrite', store => store.delete('current')); }

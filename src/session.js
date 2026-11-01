const DATABASE = 'private-canvas-connection-v1';
const STORE = 'connection';
const RETENTION = 'until-sign-out';
// Legacy expiresAt was only a local retention timer, not the GitHub token expiry.
export function normalizeConnection(record, expected) {
  if (!record || typeof record.token !== 'string' || !record.token.startsWith('github_pat_') ||
      record.token.length <= 'github_pat_'.length ||
      !['owner', 'repo', 'branch'].every(key => typeof expected[key] === 'string' && expected[key] && record[key] === expected[key])) return null;
  const permanent = record.retention === RETENTION && record.expiresAt === null;
  const legacy = record.retention === undefined && Number.isFinite(record.expiresAt) && record.expiresAt > 0;
  if (!permanent && !legacy) return null;
  return { owner: record.owner, repo: record.repo, branch: record.branch, token: record.token, retention: RETENTION, expiresAt: null };
}
export function validConnection(record, expected) { return !!normalizeConnection(record, expected); }
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
  const stored = await access('readonly', store => store.get('current'));
  const record = normalizeConnection(stored, expected);
  if (!record) return null;
  if (stored.retention !== RETENTION) await access('readwrite', store => store.put(record, 'current'));
  return record;
}
export async function rememberConnection(connection) {
  const record = normalizeConnection({ ...connection, retention: RETENTION, expiresAt: null }, connection);
  if (!record) throw new Error('连接信息不完整，请重新连接。');
  await access('readwrite', store => store.put(record, 'current'));
}
export async function forgetConnection() { await access('readwrite', store => store.delete('current')); }

import { createFileOperations } from './fileOperations.js';
import { createDirectoryClient } from './directories.js';
export const MAX_BYTES = 20 * 1024 * 1024;
export function validatePath(path) {
  if (!path || !path.endsWith('.excalidraw') || path.startsWith('/') || path.split('/').some(p => !p || p === '.' || p === '..') || /[\\\x00-\x1f]/.test(path)) throw new Error('请输入有效的 .excalidraw 文件路径，不可包含 .. 或空目录。');
  return path;
}
export function toBase64(text) {
  const bytes = new TextEncoder().encode(text);
  if (bytes.length > MAX_BYTES) throw new Error('图稿超过本站 20 MB 限制，请先压缩图片或拆分图稿。');
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  return btoa(binary);
}
export function fromBase64(text) { return new TextDecoder('utf-8', { fatal: true }).decode(Uint8Array.from(atob(text.replace(/\s/g, '')), c => c.charCodeAt(0))); }
export function parseDrawing(text) {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('图稿超过本站 20 MB 限制。');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('文件不是有效的 JSON 图稿。'); }
  if (data?.type !== 'excalidraw' || !Array.isArray(data.elements)) throw new Error('这不是有效的 .excalidraw 图稿。');
  return data;
}
export function createGithub({ owner, repo, branch = 'main', token, fetcher = fetch }) {
  if (!/^[a-z\d-]+$/i.test(owner) || !/^[\w.-]+$/.test(repo) || !branch.trim()) throw new Error('仓库或分支格式不正确。');
  if (!token.startsWith('github_pat_')) throw new Error('请使用 fine-grained PAT（以 github_pat_ 开头）。');
  const base = `https://api.github.com/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}`;
  const identity = `${owner}/${repo}@${branch}`;
  const pending = new Map();
  const conditionalCache = new Map();
  async function request(suffix, options = {}) {
    const { conditional, ...fetchOptions } = options;
    const cached = conditional ? conditionalCache.get(suffix) : null;
    const response = await fetcher(base + suffix, { ...fetchOptions, signal: AbortSignal.timeout(30000), credentials: 'omit', cache: 'no-store', redirect: 'error', referrerPolicy: 'no-referrer', headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28', ...(cached?.etag ? { 'If-None-Match': cached.etag } : {}), ...(options.body ? { 'Content-Type': 'application/json' } : {}) } });
    if (response.status === 304 && cached) return cached.data;
    if (!response.ok) {
      const messages = { 401: '令牌无效或已过期，请重新连接。', 403: '权限不足或请求受限。请检查令牌所选仓库、Contents 权限、组织审批和 API 限额。', 404: '文件、分支或仓库不存在，或令牌没有访问权限。', 409: '远端已变化，保存被阻止。请下载当前备份，再加载远端版本合并。', 422: '保存被拒绝，可能文件已存在或分支受保护。请先备份并重新加载。' };
      const error = new Error(messages[response.status] || `GitHub 请求失败（${response.status}），请重试。`); error.status = response.status;
      const retryAfter = Number(response.headers?.get('retry-after'));
      const reset = response.headers?.get('x-ratelimit-remaining') === '0' ? Number(response.headers?.get('x-ratelimit-reset')) * 1000 : 0;
      error.retryAt = Math.max(reset || 0, retryAfter > 0 ? Date.now() + retryAfter * 1000 : 0); throw error;
    }
    const data = await response.json();
    if (conditional) conditionalCache.set(suffix, { etag: response.headers?.get('etag'), data });
    return data;
  }
  const fileURL = path => `/contents/${validatePath(path).split('/').map(encodeURIComponent).join('/')}`;
  return {
    identity,
    createDirectory: createDirectoryClient({ request, branch }),
    ...createFileOperations({ request, branch, validatePath }),
    async verify() { const result = await request(''); if (!result.private) throw new Error('为保护图稿，本站只连接私有仓库。'); return result; },
    async list() {
      const tree = await request(`/git/trees/${encodeURIComponent(branch)}?recursive=1`, { conditional: true });
      return { paths: tree.tree.filter(x => x.type === 'blob' && x.path.endsWith('.excalidraw')).map(x => x.path), versions: Object.fromEntries(tree.tree.filter(x => x.type === 'blob' && x.path.endsWith('.excalidraw')).map(x => [x.path, x.sha])), directories: tree.tree.filter(x => x.type === 'tree').map(x => x.path), truncated: !!tree.truncated };
    },
    async version(path) {
      const meta = await request(fileURL(path) + `?ref=${encodeURIComponent(branch)}`);
      if (meta.type !== 'file' || !meta.sha) throw new Error('远端路径不再是普通图稿文件。');
      return meta.sha;
    },
    async load(path) {
      const meta = await request(fileURL(path) + `?ref=${encodeURIComponent(branch)}`);
      if (meta.type !== 'file' || !meta.sha || meta.size > MAX_BYTES) throw new Error('请选择不超过 20 MB 的普通图稿文件。');
      // Fetch by immutable blob SHA, so concurrent edits cannot pair new content with an old SHA.
      const blob = await request(`/git/blobs/${meta.sha}`);
      if (blob.encoding !== 'base64') throw new Error('GitHub 返回了不支持的图稿编码。');
      const text = fromBase64(blob.content); return { drawing: parseDrawing(text), sha: meta.sha };
    },
    async save(path, text, sha) {
      validatePath(path); parseDrawing(text);
      const content = toBase64(text);
      const callerSHA = sha;
      const metadata = () => request(fileURL(path) + `?ref=${encodeURIComponent(branch)}`);
      const matches = async (meta, expected) => {
        if (meta.type !== 'file' || !meta.sha || meta.size > MAX_BYTES) return false;
        const blob = await request(`/git/blobs/${meta.sha}`);
        return blob.encoding === 'base64' && fromBase64(blob.content) === expected;
      };
      const conflict = () => Object.assign(new Error('此图稿在其他窗口或 GitHub 中已修改。请另存副本，或下载备份后重新打开远端版本。'), { status: 409 });
      // A previous request may have committed even though its response was lost.
      // Only adopt a new SHA when that exact attempted content is confirmed.
      const previous = pending.get(path);
      if (previous && (previous.sha === sha || previous.callerSHA === sha)) {
        sha = previous.sha;
        let meta;
        try { meta = await metadata(); } catch (e) { if (e.status !== 404) throw e; }
        if (meta && await matches(meta, previous.text)) {
          sha = meta.sha;
          if (previous.text === text) { pending.delete(path); return { content: { sha }, recovered: true }; }
        } else if (meta ? meta.sha !== sha : !!sha) { throw conflict(); }
        pending.delete(path);
      }
      if (!sha) {
        let exists = false;
        try { await metadata(); exists = true; } catch (e) { if (e.status !== 404) throw e; }
        if (exists) throw new Error('这个目录已存在同名图稿。请修改文件名，或先打开已有图稿再编辑。');
      }
      pending.set(path, { text, sha, callerSHA });
      try {
        const result = await request(fileURL(path), { method: 'PUT', body: JSON.stringify({ message: `${sha ? 'Update' : 'Create'} drawing: ${path}`, content, ...(sha ? { sha } : {}), branch }) });
        if (!result.content?.sha) throw new Error('GitHub 保存结果不完整，请重试以核对是否已保存。');
        pending.delete(path); return result;
      } catch (error) {
        if ([401, 403, 404].includes(error.status)) { pending.delete(path); throw error; }
        try {
          const meta = await metadata();
          if (await matches(meta, text)) { pending.delete(path); return { content: { sha: meta.sha }, recovered: true }; }
        } catch { /* Keep the original error and pending snapshot for a later retry. */ }
        if (error.status === 409) throw conflict();
        throw error;
      }
    }
  };
}

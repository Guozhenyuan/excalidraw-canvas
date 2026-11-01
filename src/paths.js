import { validatePath } from './github.js';
export const directoryOf = path => path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '';
export const filenameOf = path => path.split('/').pop() || '';
export function drawingPath(directory, filename) {
  const name = filename.trim();
  if (!name || /[/\\\x00-\x1f]/.test(name)) throw new Error('请填写文件名；文件夹请从目录中选择。');
  const full = /\.excalidraw$/i.test(name) ? name.replace(/\.excalidraw$/i, '.excalidraw') : name + '.excalidraw';
  return validatePath((directory ? directory + '/' : '') + full);
}
export function directoryChoices(directories, files, selected = '') {
  const result = new Set(['', selected]);
  for (const path of [...directories, ...files.map(directoryOf)]) {
    const segments = path.split('/');
    for (let i = 1; i <= segments.length; i++) result.add(segments.slice(0, i).join('/'));
  }
  return [...result].sort((a, b) => a.localeCompare(b, 'zh-CN'));
}
export function parseGithubLocation(input, { owner, repo, branch }) {
  let url;
  try { url = new URL(input.trim()); } catch { throw new Error('请粘贴 GitHub 的文件或目录链接。'); }
  if (url.protocol !== 'https:' || url.hostname !== 'github.com' || url.username || url.password || url.search || url.hash) throw new Error('请使用不含额外参数的 https://github.com 文件或目录链接。');
  let parts;
  try { parts = url.pathname.split('/').slice(1).map(decodeURIComponent); } catch { throw new Error('链接编码无效。'); }
  const [user, repository, kind, ...rest] = parts;
  if (user?.toLowerCase() !== owner.toLowerCase() || repository?.toLowerCase() !== repo.toLowerCase()) throw new Error('请选择当前连接的私有仓库中的链接。');
  if (!kind) return { directory: '', filename: '' };
  if (!['tree', 'blob'].includes(kind)) throw new Error('请使用 GitHub 文件（blob）或目录（tree）链接。');
  const target = rest.join('/'), prefix = branch + '/';
  if (target !== branch && !target.startsWith(prefix)) throw new Error('链接分支与当前连接不同，请使用当前分支的链接。');
  const path = target === branch ? '' : target.slice(prefix.length).replace(/\/$/, '');
  if (kind === 'blob') { validatePath(path); return { directory: directoryOf(path), filename: filenameOf(path) }; }
  if (path) validatePath(path + '/检查.excalidraw');
  return { directory: path, filename: '' };
}

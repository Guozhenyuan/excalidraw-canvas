export function validateDirectory(path) {
  if (typeof path !== 'string' || !path || /[\\\x00-\x1f\x7f]/.test(path) || path.split('/').some(part => !part.trim() || part === '.' || part === '..' || part.toLowerCase() === '.git')) throw new Error('请输入有效目录名称，不能包含空层级、.. 或反斜杠。');
  return path;
}
export function newDirectoryPath(parent, name) {
  const child = name.trim();
  validateDirectory(child);
  return validateDirectory(parent ? parent + '/' + child : child);
}
export function createDirectoryClient({ request, branch }) {
  return async function createDirectory(path) {
    validateDirectory(path);
    const url = '/contents/' + path.split('/').map(encodeURIComponent).join('/');
    const inspect = async (target = path) => {
      try { const data = await request('/contents/' + target.split('/').map(encodeURIComponent).join('/') + '?ref=' + encodeURIComponent(branch)); return Array.isArray(data) ? 'directory' : 'file'; }
      catch (e) { if (e.status === 404) return 'missing'; throw e; }
    };
    const state = await inspect();
    if (state === 'directory') return { path, existed: true };
    if (state === 'file') throw new Error('此位置已有同名文件，不能创建目录。请换一个名称。');
    const parts = path.split('/');
    for (let i = 1; i < parts.length; i++) {
      const parent = await inspect(parts.slice(0, i).join('/'));
      if (parent === 'file') throw new Error('上级路径是文件，不能在文件内新建目录。');
      if (parent === 'missing') break;
    }
    try {
      // Git tracks files, so a marker keeps the directory visible even before
      // the first drawing exists. Never supply a SHA or replace another file.
      const result = await request(url + '/.gitkeep', { method: 'PUT', body: JSON.stringify({ message: `Create directory: ${path}`, content: '', branch }) });
      if (!result.content?.sha) throw new Error('目录创建结果不完整。');
      return { path, existed: false };
    } catch (error) {
      if ([401, 403].includes(error.status)) throw error;
      try { if (await inspect() === 'directory') return { path, existed: true, recovered: true }; }
      catch { /* Preserve the original error if the result cannot be checked. */ }
      throw error;
    }
  };
}

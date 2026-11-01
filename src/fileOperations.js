// Rename and delete change one Git tree in one commit. The branch is never forced.
export function createFileOperations({ request, branch, validatePath }) {
  const refPath = 'heads/' + branch.split('/').map(encodeURIComponent).join('/');
  const conflict = () => Object.assign(new Error('文件或仓库已在其他窗口发生变化。请刷新目录；若是当前画布，请先备份并重新打开，再确认操作。'), { status: 409 });
  async function mutate(source, destination, expectedSHA) {
    validatePath(source); if (destination) validatePath(destination);
    if (!expectedSHA) throw new Error('缺少文件版本，请刷新目录后重试。');
    if (source === destination) throw new Error('新名称与原名称相同。');
    const head = (await request(`/git/ref/${refPath}`)).object.sha;
    const commit = await request(`/git/commits/${head}`);
    const cache = new Map();
    async function entryAt(path) {
      let treeSHA = commit.tree.sha;
      const parts = path.split('/');
      for (let i = 0; i < parts.length; i++) {
        if (!cache.has(treeSHA)) cache.set(treeSHA, await request(`/git/trees/${treeSHA}`));
        const tree = cache.get(treeSHA);
        if (tree.truncated) throw new Error('目录内容过多，无法安全确认文件，请在 GitHub 中操作。');
        const entry = tree.tree.find(item => item.path === parts[i]);
        if (!entry) return null;
        if (i === parts.length - 1) return entry;
        if (entry.type !== 'tree') throw new Error('目标路径中存在同名文件，不能作为目录使用。');
        treeSHA = entry.sha;
      }
    }
    const sourceEntry = await entryAt(source);
    if (!sourceEntry || sourceEntry.sha !== expectedSHA) throw conflict();
    if (sourceEntry.type !== 'blob' || !['100644', '100755'].includes(sourceEntry.mode)) throw new Error('只支持普通图稿文件。');
    if (destination && await entryAt(destination)) throw new Error('目标位置已有同名文件，请使用其他名称。');
    const tree = [{ path: source, mode: sourceEntry.mode, type: 'blob', sha: null }];
    if (destination) tree.push({ path: destination, mode: sourceEntry.mode, type: 'blob', sha: sourceEntry.sha });
    const createdTree = await request('/git/trees', { method: 'POST', body: JSON.stringify({ base_tree: commit.tree.sha, tree }) });
    const created = await request('/git/commits', { method: 'POST', body: JSON.stringify({ message: destination ? `Rename drawing: ${source} -> ${destination}` : `Delete drawing: ${source}`, tree: createdTree.sha, parents: [head] }) });
    try {
      await request(`/git/refs/${refPath}`, { method: 'PATCH', body: JSON.stringify({ sha: created.sha, force: false }) });
    } catch (error) {
      // A dropped response must not cause a second delete or rename.
      let confirmed = false;
      try {
        const current = (await request(`/git/ref/${refPath}`)).object.sha;
        confirmed = current === created.sha;
        if (!confirmed && current !== head) {
          const comparison = await request(`/compare/${created.sha}...${current}`);
          confirmed = comparison.status === 'ahead' || comparison.status === 'identical';
        }
      } catch { /* The caller will retain its canvas and pause synchronization. */ }
      if (!confirmed) {
        if ([409, 422].includes(error.status)) throw conflict();
        if ([401, 403].includes(error.status)) throw error;
        throw new Error('暂时无法确认操作结果。当前画布仍保留，请先刷新目录核对，勿重复删除或重命名。');
      }
    }
    return { sha: sourceEntry.sha, commit: created.sha, path: destination || null };
  }
  return { rename: (from, to, sha) => mutate(from, to, sha), remove: (path, sha) => mutate(path, null, sha) };
}

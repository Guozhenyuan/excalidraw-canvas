export function dataVizItems(data) {
  if (data?.type !== 'excalidrawlib' || data.version !== 1 || !Array.isArray(data.library) || !data.library.length ||
      data.library.some(elements => !Array.isArray(elements) || !elements.length || elements.some(element => !element || typeof element.id !== 'string' || typeof element.type !== 'string'))) {
    throw new Error('Data Viz 素材文件不完整，请刷新后重试。');
  }
  // Fixed IDs identify bundled items across Excalidraw normalization.
  return data.library.map((elements, index) => ({ id: `builtin-data-viz-v1-${index + 1}`, status: 'published', created: 1608336000000, elements }));
}
let pending;
export function loadDataViz() {
  if (!pending) pending = fetch(new URL('./libraries/data-viz.excalidrawlib', document.baseURI), { credentials: 'omit' })
    .then(response => { if (!response.ok) throw new Error('Data Viz 素材加载失败，请重试。'); return response.json(); })
    .then(dataVizItems)
    .catch(error => { pending = null; throw error; });
  return pending;
}
export async function installDataViz(api, items, openLibraryMenu = false) {
  return api.updateLibrary({
    libraryItems: current => {
      // Legacy elements receive random versionNonces on restore, so Excalidraw's
      // element-based merge would duplicate them. Merge by our stable item IDs.
      const ids = new Set(current.map(item => item.id));
      return [...items.filter(item => !ids.has(item.id)), ...current];
    },
    merge: false, prompt: false, openLibraryMenu
  });
}

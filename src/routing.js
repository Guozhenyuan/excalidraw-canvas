const defaults = { owner: 'Guozhenyuan', repo: 'excalidraw-drawings', branch: 'main' };
export function readRoute(href) {
  const params = new URL(href).searchParams;
  return { file: params.get('file') || '', readonly: params.get('mode') === 'view', ...Object.fromEntries(Object.entries(defaults).map(([key, fallback]) => [key, params.get(key) || fallback])) };
}
export function canvasURL(href, { file = '', readonly = false, ...config }) {
  const url = new URL(href); url.search = ''; url.hash = '';
  if (file) url.searchParams.set('file', file);
  if (readonly) url.searchParams.set('mode', 'view');
  for (const [key, fallback] of Object.entries(defaults)) if (config[key] && config[key] !== fallback) url.searchParams.set(key, config[key]);
  return url.href;
}

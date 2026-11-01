// Only a successfully loaded/created file is eligible; a new filename is never
// an implicit overwrite target, and failed saves require deliberate recovery.
export function canAutoSave({ connected, dirty, busy, saving, paused, readonly, loaded, path, identity }) {
  return connected && dirty && !busy && !saving && !paused && !readonly &&
    !!loaded?.sha && loaded.path === path.trim() && loaded.identity === identity;
}
export function createDrawingPath(title, id) {
  const name = title.trim().replace(/[\\/\x00-\x1f]/g, '-').replace(/\.excalidraw$/i, '').slice(0, 80) || '未命名画布';
  return `drawings/${name}-${id}.excalidraw`;
}

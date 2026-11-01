export const SYNC_INTERVAL = 30000;
export function retryDelay(failures, retryAt = 0, now = Date.now()) {
  return Math.max(Math.min(300000, 30000 * 2 ** Math.min(failures, 4)), retryAt - now, 0);
}
// Re-read live state after every await. Network reads must never replace edits,
// a newly selected canvas, or a newer local save that finished in the meantime.
export async function synchronizeRemote({ read, list, version, load, publish, apply, conflict, missing }) {
  const start = read();
  if (!start.allowed) return 'skipped';
  const current = () => {
    const state = read();
    return state.allowed && state.context === start.context && state.epoch === start.epoch && state.loaded === start.loaded ? state : null;
  };
  const repository = await list();
  if (!current()) return 'stale';
  publish(repository);
  if (!start.loaded) return 'directory';
  let remoteSHA = repository.versions[start.loaded.path];
  if (!remoteSHA && repository.truncated) {
    // Absence in an incomplete tree is not proof of deletion.
    try { remoteSHA = await version(start.loaded.path); }
    catch (e) { if (e.status !== 404) throw e; }
    if (!current()) return 'stale';
  }
  if (!remoteSHA) { missing(); return 'missing'; }
  if (remoteSHA === start.loaded.sha) return 'unchanged';
  let state = current();
  if (!state) return 'stale';
  if (!state.clean) { conflict(); return 'conflict'; }
  if (state.interacting) return 'deferred';
  const drawing = await load(start.loaded.path);
  state = current();
  if (!state) return 'stale';
  if (!state.clean) { conflict(); return 'conflict'; }
  if (state.interacting) return 'deferred';
  await apply(drawing);
  return 'updated';
}

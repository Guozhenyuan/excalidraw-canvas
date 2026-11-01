// Only a successfully loaded/created file is eligible; a new filename is never
// an implicit overwrite target, and failed saves require deliberate recovery.
export function canAutoSave({ connected, dirty, busy, saving, paused, readonly, loaded, path, identity }) {
  return connected && dirty && !busy && !saving && !paused && !readonly &&
    !!loaded?.sha && loaded.path === path.trim() && loaded.identity === identity;
}

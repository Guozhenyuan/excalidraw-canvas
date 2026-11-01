import React from 'react';
export default function SyncControls({ enabled, setEnabled, connected, syncing, blocked, lastChecked, notice, synchronize }) {
  return <section className="sync-controls" aria-label="自动同步设置"><div className="sync-control-row"><label><input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)}/>自动同步 GitHub</label><button onClick={synchronize} disabled={!connected || blocked || syncing}>{syncing ? '同步中…' : '立即同步'}</button></div><p className="help">{enabled ? '修改后约 3 秒保存，每 30 秒检查远端更新。' : '自动同步已关闭，仍可手动保存或立即同步。'}</p><p className="sync-time" role="status">{notice || (lastChecked ? '最近检查：' + new Date(lastChecked).toLocaleTimeString() : connected ? '已连接，等待下一次同步检查。' : '连接 GitHub 后开始同步。')}</p></section>;
}

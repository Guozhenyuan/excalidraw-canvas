import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Excalidraw, MainMenu, serializeAsJSON, restore } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './style.css';
import { createGithub, parseDrawing, validatePath, MAX_BYTES } from './github';
import { canvasURL, readRoute } from './routing';
window.EXCALIDRAW_ASSET_PATH = new URL('./', location.href).href.split('?')[0].split('#')[0];
const route = readRoute(location.href);
const initialPath = route.file;
const readonly = route.readonly;
history.replaceState(null, '', canvasURL(location.href, route));
function App() {
  const [api, setApi] = useState(null), [connected, setConnected] = useState(false), [busy, setBusy] = useState(false);
  const [settings, setSettings] = useState(true), [path, setPath] = useState(initialPath), [files, setFiles] = useState([]);
  const [status, setStatus] = useState(initialPath ? '连接私有仓库后，将自动打开这张画布：' + initialPath : '先连接私有仓库，或直接开始绘图。'), [dirty, setDirty] = useState(false);
  const [owner, setOwner] = useState(route.owner), [repo, setRepo] = useState(route.repo), [branch, setBranch] = useState(route.branch);
  const [canvasPath, setCanvasPath] = useState(initialPath);
  const tokenInput = useRef(null), client = useRef(null), loaded = useRef(null), baseline = useRef(null), timer = useRef(null), lock = useRef(false), dirtyRef = useRef(false);
  const serialized = () => serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'local');
  const refreshDirty = () => { if (!api) return; const changed = baseline.current !== serialized(); dirtyRef.current = changed; setDirty(changed); };
  useEffect(() => { const listener = e => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload', listener); return () => { window.removeEventListener('beforeunload', listener); clearTimeout(timer.current); }; }, []);
  useEffect(() => { if (api && baseline.current === null) baseline.current = serialized(); }, [api]);
  const safeReplace = () => !api || baseline.current === serialized() || window.confirm('当前有未保存修改。确定放弃这些修改吗？建议先下载备份。');
  async function run(action) { if (lock.current) return; lock.current = true; setBusy(true); clearTimeout(timer.current); try { await action(); } catch (e) { setStatus(e instanceof TypeError ? '网络连接失败。请检查 GitHub API 是否可达；当前画布仍保留，可先下载备份。' : e.message); } finally { lock.current = false; setBusy(false); } }
  function applyDrawing(drawing) {
    const restored = restore(drawing, null, null);
    api.resetScene(); api.addFiles(Object.values(restored.files || {}));
    api.updateScene({ elements: restored.elements, appState: { ...restored.appState, isLoading: false } });
    api.scrollToContent(restored.elements, { fitToContent: true });
    baseline.current = serialized(); dirtyRef.current = false; setDirty(false);
  }
  function updateCanvasLink(file) {
    setCanvasPath(file);
    history.replaceState(null, '', canvasURL(location.href, { file, owner, repo, branch, readonly }));
    document.title = file.split('/').pop() + ' · 私有画布';
  }
  async function loadDrawing(file, connection = client.current) {
    const valid = validatePath(file.trim());
    const result = await connection.load(valid);
    applyDrawing(result.drawing);
    loaded.current = { path: valid, sha: result.sha, identity: connection.identity };
    setPath(valid); updateCanvasLink(valid); setStatus('已打开画布 · ' + valid);
  }
  async function connect(event) { event.preventDefault(); const token = tokenInput.current.value.trim(); tokenInput.current.value = ''; const openLinkedCanvas = !!initialPath && path === initialPath && safeReplace(); await run(async () => { const next = createGithub({ owner, repo, branch, token }); await next.verify(); const list = await next.list(); client.current = next; loaded.current = null; setConnected(true); setFiles(list.paths); setSettings(false); setStatus(list.truncated ? '已连接，文件列表不完整；可手动输入完整路径。' : '已连接私有仓库。选择图稿后点击加载。'); if (openLinkedCanvas) await loadDrawing(initialPath, next); }); }
  function disconnect() { client.current = null; loaded.current = null; setConnected(false); setFiles([]); if (tokenInput.current) tokenInput.current.value = ''; setSettings(true); setStatus('已清除连接令牌。画布仍保留在本页，关闭页面后清除。'); }
  async function load() { if (!safeReplace()) return; await run(() => loadDrawing(path)); }
  async function save() { await run(async () => { const valid = validatePath(path.trim()); const snapshot = serialized(); const previous = loaded.current; const sha = previous?.path === valid && previous.identity === client.current.identity ? previous.sha : undefined; const result = await client.current.save(valid, snapshot, sha); loaded.current = { path: valid, sha: result.content.sha, identity: client.current.identity }; baseline.current = snapshot; refreshDirty(); setPath(valid); updateCanvasLink(valid); setFiles(old => old.includes(valid) ? old : [...old, valid].sort()); setStatus('画布已保存，可复制专属链接嵌入 Notion · ' + new Date().toLocaleTimeString()); }); }
  function download() { const blob = new Blob([serialized()], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = path.split('/').pop() || '未命名.excalidraw'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); setStatus('已下载备份；远端保存状态未改变。'); }
  async function importFile(event) { const file = event.target.files?.[0]; event.target.value = ''; if (!file || !safeReplace()) return; await run(async () => { if (file.size > MAX_BYTES) throw new Error('图稿超过 20 MB。'); applyDrawing(parseDrawing(await file.text())); loaded.current = null; setPath(file.name.endsWith('.excalidraw') ? file.name : '导入.excalidraw'); baseline.current = ''; refreshDirty(); setStatus('已导入本地图稿。请确认文件名后保存到私有仓库。'); }); }
  function makeLink() { return canvasURL(location.href, { file: canvasPath, owner, repo, branch, readonly }); }
  async function copyLink() { try { await navigator.clipboard.writeText(makeLink()); setStatus('已复制这张画布的专属链接。连接仓库后会自动打开；链接不含令牌或图稿。'); } catch { setStatus('复制受浏览器限制，请从“独立窗口”链接复制地址。'); } }
  return <div className="shell">
    <header><div className="brand"><span className="logo">✎</span><div><strong title={canvasPath || '私有画布'}>{canvasPath ? canvasPath.split('/').pop().replace(/\.excalidraw$/, '') : '私有画布'}</strong><small>EXCALIDRAW · GITHUB</small></div></div><span className={'badge ' + (connected ? 'online' : '')}>{connected ? '私有仓库已连接' : '仅在本页'}{dirty ? ' · 未保存' : ''}</span><div className="header-actions"><button onClick={() => setSettings(!settings)} disabled={busy}>连接设置</button><a href={makeLink()} target="_blank" rel="noopener noreferrer">独立窗口 ↗</a></div></header>
    {settings && <section className="connection"><form onSubmit={connect}><label>GitHub 用户<input value={owner} onChange={e => setOwner(e.target.value)} disabled={connected || busy}/></label><label>私有仓库<input value={repo} onChange={e => setRepo(e.target.value)} disabled={connected || busy}/></label><label className="branch">分支<input value={branch} onChange={e => setBranch(e.target.value)} disabled={connected || busy}/></label>{!connected && <label className="token">Fine-grained PAT<input ref={tokenInput} type="password" autoComplete="off" placeholder="仅本页内存保存" required disabled={busy} spellCheck="false"/></label>}{connected ? <button type="button" onClick={disconnect} disabled={busy}>断开并清除令牌</button> : <button className="primary" disabled={busy || !api}>连接仓库</button>}</form><p>令牌只授权这个私有仓库的 Contents 读写。刷新后需重新输入；不会写入网站、链接或浏览器存储。<a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">创建令牌 ↗</a></p></section>}
    <nav className="toolbar" aria-label="图稿操作"><input className="path" aria-label="图稿路径" list="drawings" value={path} onChange={e => setPath(e.target.value)} placeholder="选择或输入：文件夹/图稿.excalidraw" disabled={busy}/><datalist id="drawings">{files.map(f => <option key={f} value={f}/>)}</datalist><button onClick={load} disabled={!connected || !api || busy || !path}>加载</button><button className="primary" onClick={save} disabled={!connected || !api || busy || !path || readonly}>保存到 GitHub</button><button onClick={download} disabled={!api || busy}>下载备份</button><label className="button">导入<input type="file" accept=".excalidraw,application/json" onChange={importFile} disabled={!api || busy || readonly} hidden/></label><button onClick={copyLink} disabled={!canvasPath || busy}>复制画布链接</button></nav>
    <div className="status" role="status" aria-live="polite"><span className="dot"/>{busy ? '正在与 GitHub 同步，请稍候…' : status}{readonly && ' · 只读显示模式'}</div>
    <main className="canvas"><Excalidraw excalidrawAPI={setApi} langCode="zh-CN" viewModeEnabled={readonly || busy} onChange={() => { clearTimeout(timer.current); if (!lock.current) timer.current = setTimeout(refreshDirty, 350); }} validateEmbeddable={() => false} UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false, export: { saveFileToDisk: true } } }}><MainMenu><MainMenu.DefaultItems.Export/><MainMenu.DefaultItems.SaveAsImage/><MainMenu.DefaultItems.ChangeCanvasBackground/></MainMenu></Excalidraw></main>
    <footer><span>图稿保存在你的私有 GitHub 仓库 · 点击保存才会同步</span><span>Notion 内遇到限制时，使用独立窗口</span></footer>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);

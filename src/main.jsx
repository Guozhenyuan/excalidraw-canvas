import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Excalidraw, MainMenu, serializeAsJSON, restore } from '@excalidraw/excalidraw';
import '@excalidraw/excalidraw/index.css';
import './style.css';
import { createGithub, parseDrawing, validatePath, MAX_BYTES } from './github';
import { canvasURL, readRoute } from './routing';
import { readConnection, rememberConnection, forgetConnection } from './session';
import { canAutoSave } from './autosave';
import { directoryOf, filenameOf, drawingPath } from './paths';
import RepositoryFiles from './RepositoryFiles';
window.EXCALIDRAW_ASSET_PATH = new URL('./', location.href).href.split('?')[0].split('#')[0];
const route = readRoute(location.href);
const readonly = route.readonly;
history.replaceState(null, '', canvasURL(location.href, route));
function App() {
  const [api, setApi] = useState(null), [connected, setConnected] = useState(false), [busy, setBusy] = useState(false), [saving, setSaving] = useState(false);
  const [checking, setChecking] = useState(true), [remember, setRemember] = useState(true), [remembered, setRemembered] = useState(false);
  const [panel, setPanel] = useState(null), [path, setPath] = useState(route.file), [files, setFiles] = useState([]), [newTitle, setNewTitle] = useState('');
  const [directories, setDirectories] = useState([]), [folder, setFolder] = useState(directoryOf(route.file)), [saveName, setSaveName] = useState('未命名画布.excalidraw');
  const [refreshing, setRefreshing] = useState(false), [listNotice, setListNotice] = useState('');
  const [status, setStatus] = useState('正在检查连接…'), [dirty, setDirty] = useState(false), [revision, setRevision] = useState(0), [paused, setPaused] = useState(false);
  const [owner, setOwner] = useState(route.owner), [repo, setRepo] = useState(route.repo), [branch, setBranch] = useState(route.branch);
  const [canvasPath, setCanvasPath] = useState(route.file), [ready, setReady] = useState(false);
  const tokenInput = useRef(null), client = useRef(null), loaded = useRef(null), baseline = useRef(null), observed = useRef(null), timer = useRef(null), lock = useRef(false), dirtyRef = useRef(false), startup = useRef(false);
  const serialized = () => serializeAsJSON(api.getSceneElements(), api.getAppState(), api.getFiles(), 'local');
  const refreshDirty = () => {
    if (!api) return;
    const content = serialized();
    if (observed.current !== content) { observed.current = content; setRevision(v => v + 1); }
    const changed = baseline.current !== content; dirtyRef.current = changed; setDirty(changed);
  };
  useEffect(() => {
    const listener = e => { if (dirtyRef.current) { e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', listener);
    return () => { window.removeEventListener('beforeunload', listener); clearTimeout(timer.current); };
  }, []);
  useEffect(() => {
    if (!api || startup.current) return;
    startup.current = true; baseline.current = serialized(); observed.current = baseline.current;
    (async () => {
      try {
        const saved = await readConnection(route);
        if (saved) { setRemembered(true); await connectWith(saved, false); }
        else { setStatus('首次使用，请连接你的 GitHub 图稿仓库。'); setPanel('connect'); }
      } catch { setStatus('此环境无法读取已记住的连接，请连接一次；也可使用独立窗口。'); setPanel('connect'); }
      finally { setChecking(false); }
    })();
  }, [api]);
  useEffect(() => {
    if (!canAutoSave({ connected, dirty, busy, saving, paused, readonly, loaded: loaded.current, path, identity: client.current?.identity })) return;
    const timeout = setTimeout(() => save(true), 3000);
    return () => clearTimeout(timeout);
  }, [connected, dirty, busy, saving, paused, revision, path]);
  const safeReplace = () => !api || baseline.current === serialized() || window.confirm('当前修改尚未保存。确定放弃吗？可以先下载备份。');
  const showError = e => {
    setStatus(e.name === 'TimeoutError' ? 'GitHub 响应超时。当前修改已保留，请重试保存，系统会先核对上次是否成功。' : e instanceof TypeError ? '网络连接失败。修改仍在当前页面，请下载备份或稍后重试保存。' : e.message);
    setPaused(true);
    if (e.status === 401) { client.current = null; setConnected(false); setRemembered(false); setPanel('connect'); forgetConnection().catch(() => {}); }
  };
  async function run(action) {
    if (lock.current) return;
    lock.current = true; setBusy(true); clearTimeout(timer.current);
    try { await action(); } catch (e) { showError(e); }
    finally { lock.current = false; setBusy(false); }
  }
  async function applyDrawing(drawing) {
    const restored = restore(drawing, null, null);
    api.resetScene(); api.addFiles(Object.values(restored.files || {}));
    api.updateScene({ elements: restored.elements, appState: { ...restored.appState, isLoading: false } });
    // Wait for React's scene/app-state update before capturing the clean baseline.
    await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    api.scrollToContent(restored.elements, { fitToContent: true });
    baseline.current = serialized(); observed.current = baseline.current; dirtyRef.current = false; setDirty(false);
  }
  function updateCanvasLink(file) {
    setCanvasPath(file);
    history.replaceState(null, '', canvasURL(location.href, { file, owner, repo, branch, readonly }));
    document.title = file.split('/').pop().replace(/\.excalidraw$/, '') + ' · 私有画布';
  }
  async function loadDrawing(file, connection = client.current) {
    const valid = validatePath(file.trim()); const result = await connection.load(valid);
    await applyDrawing(result.drawing);
    loaded.current = { path: valid, sha: result.sha, identity: connection.identity };
    setPath(valid); updateCanvasLink(valid); setFolder(directoryOf(valid)); setSaveName(filenameOf(valid)); setReady(true); setPaused(false); setPanel(null); setStatus(readonly ? '只读画布' : '已同步 · 修改后自动保存');
  }
  async function connectWith(credentials, persist) {
    await run(async () => {
      const next = createGithub(credentials); await next.verify();
      client.current = next; loaded.current = null; setConnected(true); setPaused(false);
      let storageNotice = '';
      if (persist) {
        try { await rememberConnection(credentials); setRemembered(true); }
        catch { setRemembered(false); storageNotice = '浏览器阻止了记住连接，本次仍可使用；刷新后需重新连接。'; }
      }
      if (path && safeReplace()) await loadDrawing(path, next);
      else { setPanel('files'); setStatus('已连接。选择或新建一张画布。'); }
      await refreshRepository(next);
      if (storageNotice) setStatus(storageNotice);
    });
  }
  async function refreshRepository(connection = client.current) {
    if (!connection || refreshing) return;
    setRefreshing(true);
    try { const list = await connection.list(); setFiles(list.paths); setDirectories(list.directories); setListNotice(list.truncated ? '仓库内容较多，列表可能不完整。同名文件仍受保护，可粘贴 GitHub 地址定位目录。' : ''); }
    catch { setListNotice('目录读取失败，请点“刷新目录”重试。当前画布保存不受影响。'); }
    finally { setRefreshing(false); }
  }
  async function connect(event) {
    event.preventDefault(); const token = tokenInput.current.value.trim(); tokenInput.current.value = '';
    let forgetFailed = false;
    if (!remember) { try { await forgetConnection(); setRemembered(false); } catch { forgetFailed = true; } }
    await connectWith({ owner, repo, branch, token }, remember);
    if (forgetFailed) setStatus('本次连接仅保留在页面中。如本浏览器曾记住连接，请在浏览器设置中清除旧的网站数据。');
  }
  async function disconnect() {
    if (!safeReplace()) return;
    await run(async () => {
      let cleared = true; try { await forgetConnection(); } catch { cleared = false; }
      client.current = null; loaded.current = null; setConnected(false); setRemembered(false); setReady(false); setPaused(false); setFiles([]); setDirectories([]);
      await applyDrawing({ type: 'excalidraw', version: 2, elements: [], appState: {}, files: {} });
      setPanel('connect'); setStatus(cleared ? '已退出并清除此浏览器的连接记录。' : '本页已退出，但无法清除本机记录。请在浏览器设置中清除本站数据，再重新打开。');
    });
  }
  async function load(file = path) { if (!safeReplace()) return; await run(() => loadDrawing(file)); }
  async function createCanvas(event) {
    event.preventDefault(); if (!safeReplace()) return;
    await run(async () => {
      const file = drawingPath(folder, newTitle);
      const text = JSON.stringify({ type: 'excalidraw', version: 2, source: location.origin, elements: [], appState: {}, files: {} });
      const result = await client.current.save(file, text);
      await applyDrawing(parseDrawing(text));
      loaded.current = { path: file, sha: result.content.sha, identity: client.current.identity };
      setPath(file); updateCanvasLink(file); setSaveName(filenameOf(file)); setFiles(old => [...old, file].sort()); setReady(true); setPanel(null); setPaused(false); setNewTitle(''); setStatus('画布已创建 · 修改后自动保存');
    });
  }
  async function save(automatic = false, destination = path) {
    if (lock.current || !client.current || readonly || !ready) return;
    if (!destination) { setPanel('files'); setStatus('请选择 GitHub 目录并填写文件名。'); return; }
    if (automatic && !canAutoSave({ connected, dirty: baseline.current !== serialized(), busy, saving, paused, readonly, loaded: loaded.current, path, identity: client.current.identity })) return;
    lock.current = true; setSaving(true); clearTimeout(timer.current);
    try {
      const valid = validatePath(destination.trim()), snapshot = serialized(), previous = loaded.current;
      const sha = previous?.path === valid && previous.identity === client.current.identity ? previous.sha : undefined;
      const result = await client.current.save(valid, snapshot, sha);
      loaded.current = { path: valid, sha: result.content.sha, identity: client.current.identity };
      baseline.current = snapshot; setPath(valid); updateCanvasLink(valid); if (valid !== path) { setFolder(directoryOf(valid)); setSaveName(filenameOf(valid)); } setReady(true); setPaused(false);
      setFiles(old => old.includes(valid) ? old : [...old, valid].sort());
      setStatus((result.recovered ? '已核对 GitHub，保存成功 · ' : '已保存到 GitHub · ') + valid + ' · ' + new Date().toLocaleTimeString());
    } catch (e) { showError(e); }
    finally { lock.current = false; setSaving(false); refreshDirty(); }
  }
  function download() {
    const url = URL.createObjectURL(new Blob([serialized()], { type: 'application/json' }));
    const a = document.createElement('a'); a.href = url; a.download = path.split('/').pop() || '未命名.excalidraw'; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(event) {
    const file = event.target.files?.[0]; event.target.value = ''; if (!file || !safeReplace()) return;
    await run(async () => {
      if (file.size > MAX_BYTES) throw new Error('图稿超过 20 MB。');
      await applyDrawing(parseDrawing(await file.text())); loaded.current = null;
      setSaveName(file.name.endsWith('.excalidraw') ? file.name : '导入.excalidraw'); setPath(''); updateCanvasLink(''); setPanel('files'); baseline.current = ''; refreshDirty(); setReady(true); setPaused(true);
      setStatus('已导入。请选择 GitHub 目录和文件名，首次保存后会自动同步。');
    });
  }
  function makeLink() { return canvasURL(location.href, { file: canvasPath, owner, repo, branch, readonly }); }
  async function copyLink() {
    try { await navigator.clipboard.writeText(makeLink()); setStatus('画布链接已复制，可直接用于 Notion Embed。'); }
    catch { setStatus('复制被浏览器限制，请复制地址栏中的画布网址。'); }
  }
  const blocked = busy || saving || checking;
  const name = canvasPath ? canvasPath.split('/').pop().replace(/\.excalidraw$/, '').replace(/-[a-f0-9]{8}$/, '') : '我的画布';
  const stateLabel = checking ? '正在连接' : busy ? '正在加载' : saving ? '正在保存…' : paused ? '同步已暂停' : dirty ? '等待保存…' : ready ? '已同步 GitHub' : connected ? '已连接' : '未连接';
  return <div className="shell">
    <header><div className="brand"><span className="logo">✎</span><strong title={canvasPath || name}>{name}</strong></div><span className={'badge ' + (paused ? 'warning' : connected ? 'online' : '')} role="status">{stateLabel}</span><div className="header-actions">{!readonly && <button onClick={() => save()} disabled={blocked || !connected || !ready}>{saving ? '保存中…' : '保存'}</button>}<button onClick={copyLink} disabled={!canvasPath || busy}>复制链接</button><button onClick={() => setPanel(panel ? null : connected ? 'files' : 'connect')} disabled={blocked}>☰</button></div></header>
    {panel && <section className="drawer" aria-label="画布管理">
      <div className="drawer-top"><strong>{panel === 'connect' ? '连接你的 GitHub' : '我的画布'}</strong><button onClick={() => setPanel(null)}>收起 ×</button></div>
      {panel === 'connect' ? <><p className="intro">只需设置一次。选择记住连接后，本浏览器下次打开画布会自动加载。图稿保存在你的私有仓库。</p><form onSubmit={connect} className="connect-form">
        <details><summary>仓库设置</summary><label>GitHub 用户<input value={owner} onChange={e => setOwner(e.target.value)} disabled={connected || blocked}/></label><label>私有仓库<input value={repo} onChange={e => setRepo(e.target.value)} disabled={connected || blocked}/></label><label>分支<input value={branch} onChange={e => setBranch(e.target.value)} disabled={connected || blocked}/></label></details>
        {!connected && <><a className="setup-link" href="https://github.com/settings/personal-access-tokens/new?name=Private%20Canvas&target_name=Guozhenyuan&expires_in=30&contents=write" target="_blank" rel="noopener noreferrer">① 在 GitHub 创建连接凭据 ↗</a><p className="help">名称、30 天有效期和 Contents 读写权限已预填。请在 Repository access 选择 Only select repositories，仅勾选 excalidraw-drawings，再点击 Generate token。不要把生成的凭据发到聊天。</p><label>② 粘贴 GitHub 生成的连接凭据<input ref={tokenInput} type="password" autoComplete="off" required disabled={blocked} spellCheck="false"/></label><label className="remember"><input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)}/>在此浏览器记住连接（最多 30 天）</label><p className="help">这会将访问凭据保存在本机浏览器中；其他使用此浏览器的人也可能访问。换设备、令牌过期或清除网站数据后需重新连接。</p><button className="primary" disabled={blocked || !api}>连接并打开画布</button></>}
        {connected && <><p>{remembered ? '本浏览器已记住连接。' : '当前连接仅在本次页面中保留。'}</p><button type="button" onClick={disconnect} disabled={blocked}>退出并清除连接</button></>}
      </form></> : <>
        <RepositoryFiles directories={directories} files={files} folder={folder} setFolder={setFolder} newTitle={newTitle} setNewTitle={setNewTitle} saveName={saveName} setSaveName={setSaveName} activePath={path} ready={ready} blocked={blocked} readonly={readonly} createCanvas={createCanvas} saveAs={file => save(false, file)} load={load} refresh={() => refreshRepository()} refreshing={refreshing} listNotice={listNotice} config={{ owner, repo, branch }} download={download} importFile={importFile}/>
        <div className="drawer-bottom"><button onClick={() => setPanel('connect')} disabled={blocked}>账户与连接</button><a href={makeLink()} target="_blank" rel="noopener noreferrer">独立窗口 ↗</a></div>
      </>}
    </section>}
    <main className="canvas"><Excalidraw excalidrawAPI={setApi} langCode="zh-CN" viewModeEnabled={readonly || busy || checking || !ready} onChange={() => { clearTimeout(timer.current); if (!busy && !checking && ready) timer.current = setTimeout(refreshDirty, 250); }} validateEmbeddable={() => false} UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false, export: { saveFileToDisk: true } } }}><MainMenu><MainMenu.DefaultItems.Export/><MainMenu.DefaultItems.SaveAsImage/><MainMenu.DefaultItems.ChangeCanvasBackground/></MainMenu></Excalidraw>
      {!ready && !panel && <div className="welcome"><h1>{checking ? '正在打开画布…' : route.file ? name : '每个想法，一张画布。'}</h1><p>{checking ? '正在读取此浏览器记住的连接。' : connected ? '新建画布，或者打开已有图稿。' : '连接一次 GitHub，随后自动保存你的修改。'}</p>{!checking && <button className="primary" onClick={() => setPanel(connected ? 'files' : 'connect')}>{connected ? '打开我的画布' : '连接 GitHub'}</button>}</div>}
    </main>
    <footer><span role="status" aria-live="polite">{status}</span>{paused && ready && <><button onClick={() => save()} disabled={blocked || !connected || readonly}>重试保存</button><button onClick={() => { setSaveName(filenameOf(path).replace(/\.excalidraw$/, '') + '-副本.excalidraw'); setPanel('files'); }} disabled={blocked || !connected || readonly}>另存副本</button><button onClick={download}>下载备份</button></>}</footer>
  </div>;
}
createRoot(document.getElementById('root')).render(<App/>);

import React, { useState } from 'react';
import FileList from './FileList';
import DirectoryCreator from './DirectoryCreator';
import { directoryOf, filenameOf, directoryChoices, drawingPath, parseGithubLocation } from './paths';
export default function RepositoryFiles({ directories, files, versions, renameFile, deleteFile, folder, setFolder, newTitle, setNewTitle, saveName, setSaveName, activePath, ready, blocked, readonly, createDirectory, createCanvas, saveAs, load, refresh, refreshing, listNotice, config, download, importFile }) {
  const [address, setAddress] = useState(''), [addressError, setAddressError] = useState(''), [locatedFile, setLocatedFile] = useState('');
  const options = directoryChoices(directories, files, folder);
  const visible = files.filter(file => directoryOf(file) === folder);
  let target = '', pathError = '';
  try { target = drawingPath(folder, saveName); } catch (e) { pathError = e.message; }
  const exists = files.includes(target) && target !== activePath;
  let newPath = '', newError = '';
  if (newTitle.trim()) { try { newPath = drawingPath(folder, newTitle); } catch (e) { newError = e.message; } }
  const newExists = files.includes(newPath);
  const locate = event => {
    event.preventDefault();
    try { const location = parseGithubLocation(address, config); setFolder(location.directory); if (location.filename) setSaveName(location.filename); setLocatedFile(location.filename ? drawingPath(location.directory, location.filename) : ''); setAddressError(''); }
    catch (e) { setLocatedFile(''); setAddressError(e.message); }
  };
  return <>
    <div className="current-path">当前画布保存到<strong>{activePath || '尚未保存到 GitHub'}</strong></div>
    <div className="directory-picker"><label>GitHub 保存目录<select value={folder} onChange={e => setFolder(e.target.value)} disabled={blocked}>{options.map(dir => <option key={dir} value={dir}>{dir ? '/' + dir + '/' : '/（仓库根目录）'}</option>)}</select></label><button onClick={refresh} disabled={blocked || refreshing}>{refreshing ? '读取中…' : '刷新目录'}</button></div>
    {!readonly && <DirectoryCreator parent={folder} directories={options} blocked={blocked} createDirectory={createDirectory}/>}
    {listNotice && <p className="help" role="status">{listNotice}</p>}
    <details><summary>粘贴 GitHub 地址定位</summary><form className="address-form" onSubmit={locate}><input aria-label="GitHub 文件或目录地址" placeholder="https://github.com/…/tree/main/目录" value={address} onChange={e => { setAddress(e.target.value); setLocatedFile(''); }} disabled={blocked}/><button disabled={blocked || !address.trim()}>定位</button></form>{addressError && <p className="field-error" role="alert">{addressError}</p>}{locatedFile && <button onClick={() => load(locatedFile)} disabled={blocked}>打开链接中的图稿</button>}<p className="help">仅定位当前仓库和分支。选择已有文件后，请先打开再编辑。</p></details>
    <FileList files={files} visible={visible} versions={versions} directories={options} activePath={activePath} blocked={blocked} readonly={readonly} load={load} renameFile={renameFile} deleteFile={deleteFile}/>

    {!readonly && <><form className="new-canvas" onSubmit={createCanvas}><input aria-label="新画布名称" placeholder="新画布名称（无需后缀）" value={newTitle} onChange={e => setNewTitle(e.target.value)} disabled={blocked}/><button className="primary" disabled={blocked || !newPath || newExists}>新建画布</button></form>{newPath && <p className="path-preview">新画布位置：/{newPath}</p>}{(newError || newExists) && <p className="field-error">{newExists ? '同名画布已存在，请从列表打开或使用新名称。' : newError}</p>}</>}
    {!readonly && ready && <form className="save-location" onSubmit={event => { event.preventDefault(); if (target && !exists) saveAs(target); }}><label>文件名<input aria-label="另存文件名" value={saveName} onChange={e => setSaveName(e.target.value)} placeholder="例如：研究计划.excalidraw" disabled={blocked}/></label><p className="path-preview">保存位置：<strong>{target ? '/' + target : '请选择目录并填写文件名'}</strong></p>{(pathError || exists) && <p className="field-error">{exists ? '此位置已有同名图稿。请改名，或先从上方列表打开它。' : pathError}</p>}<button className="primary" disabled={blocked || !target || exists}>{target === activePath ? '保存当前画布' : '保存到所选位置'}</button><p className="help">保存成功后，后续编辑会自动保存到该位置。另存不会删除原文件。</p></form>}
    <div className="tools"><button onClick={download} disabled={!ready || blocked}>下载备份</button>{!readonly && <label className="button">导入图稿<input type="file" accept=".excalidraw,application/json" onChange={importFile} disabled={blocked} hidden/></label>}</div>
  </>;
}

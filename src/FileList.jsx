import React, { useState } from 'react';
import { directoryOf, filenameOf, drawingPath } from './paths';
export default function FileList({ files, visible, versions = {}, directories, activePath, blocked, readonly, load, renameFile, deleteFile }) {
  const [operation, setOperation] = useState(null), [name, setName] = useState(''), [directory, setDirectory] = useState(''), [error, setError] = useState('');
  const begin = (kind, file) => { setOperation({ kind, file, sha: versions[file] }); setName(filenameOf(file)); setDirectory(directoryOf(file)); setError(''); };
  let target = '', validation = '';
  if (operation?.kind === 'rename') {
    try { target = drawingPath(directory, name); if (target === operation.file) validation = '请填写新名称或选择其他目录。'; else if (files.includes(target)) validation = '该位置已有同名图稿，请使用其他名称。'; }
    catch (e) { validation = e.message; }
  }
  const submit = async event => {
    event.preventDefault(); if (!operation || blocked || validation) return;
    setError('');
    try {
      if (operation.kind === 'rename') await renameFile(operation.file, target, operation.sha);
      else await deleteFile(operation.file, operation.sha);
      setOperation(null);
    } catch (e) { setError(e.message); }
  };
  return <>
    <div className="file-list">{visible.length ? visible.map(file => <div key={file} className={'file-row ' + (file === activePath ? 'selected' : '')}><button className="file-open" onClick={() => load(file)} disabled={blocked || !!operation}>{filenameOf(file)}{file === activePath && <small>当前画布</small>}</button>{!readonly && <div className="file-actions"><button aria-label={'重命名 ' + file} onClick={() => begin('rename', file)} disabled={blocked || !!operation}>重命名</button><button className="danger-text" aria-label={'删除 ' + file} onClick={() => begin('delete', file)} disabled={blocked || !!operation}>删除</button></div>}</div>) : <p className="empty-directory">此目录暂无画布</p>}</div>
    {operation && <section className="file-operation" role="dialog" aria-label={operation.kind === 'rename' ? '重命名或移动画布' : '确认删除画布'}><h3>{operation.kind === 'rename' ? '重命名 / 移动' : '删除画布'}</h3><p className="path-preview">{operation.file}</p><form onSubmit={submit}>
      {operation.kind === 'rename' ? <><label>目标目录<select value={directory} onChange={e => setDirectory(e.target.value)} disabled={blocked}>{directories.map(dir => <option key={dir} value={dir}>{dir ? '/' + dir + '/' : '/（仓库根目录）'}</option>)}</select></label><label>新文件名<input aria-label="新文件名" value={name} onChange={e => setName(e.target.value)} disabled={blocked}/></label><p className="path-preview">新位置：{target || '请填写文件名'}</p><p className="help">更名后旧链接失效，请重新复制链接并更新 Notion 嵌入。当前画布未保存的修改会先保存。</p></> : <><p>确认从 GitHub 仓库删除此图稿？</p><p className="help">删除会记录在 GitHub 历史中，旧画布链接将无法打开。若正在编辑此图稿，页面内容会保留，自动保存会停止。</p></>}
      {(validation || error) && <p className="field-error" role="alert">{error || validation}</p>}<div className="operation-actions"><button type="button" onClick={() => setOperation(null)} disabled={blocked}>取消</button><button className={operation.kind === 'delete' ? 'danger' : 'primary'} disabled={blocked || !!validation}>{blocked ? '处理中…' : operation.kind === 'delete' ? '确认删除' : '确认重命名'}</button></div>
    </form></section>}
  </>;
}

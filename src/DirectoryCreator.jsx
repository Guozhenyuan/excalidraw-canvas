import React, { useState } from 'react';
import { newDirectoryPath } from './directories';
export default function DirectoryCreator({ parent, directories, blocked, createDirectory }) {
  const [open, setOpen] = useState(false), [base, setBase] = useState(''), [name, setName] = useState(''), [error, setError] = useState(''), [submitting, setSubmitting] = useState(false);
  const busy = blocked || submitting;
  let target = '', invalid = '';
  if (name.trim()) { try { target = newDirectoryPath(base, name); } catch (e) { invalid = e.message; } }
  const submit = async event => {
    event.preventDefault(); if (!target || invalid || busy) return;
    setSubmitting(true); setError('');
    try { await createDirectory(target); setOpen(false); setName(''); }
    catch (e) { setError(e.message); }
    finally { setSubmitting(false); }
  };
  return <div className="directory-create">
    {!open ? <button onClick={() => { setBase(parent); setName(''); setError(''); setOpen(true); }} disabled={busy}>＋ 新建目录</button> : <form onSubmit={submit} aria-label="新建目录"><strong>新建目录</strong><p className="path-preview">创建于：{base ? '/' + base + '/' : '/（仓库根目录）'}</p><label>目录名称<input aria-label="新目录名称" value={name} onChange={e => { setName(e.target.value); setError(''); }} placeholder="例如：研究笔记 或 项目/草稿" disabled={busy}/></label>{target && <p className="path-preview">完整位置：/{target}/</p>}{(invalid || error) && <p className="field-error" role="alert">{error || invalid}</p>}<div className="operation-actions"><button type="button" onClick={() => setOpen(false)} disabled={busy}>取消</button><button className="primary" disabled={busy || !target || !!invalid}>{busy ? '创建中…' : target && directories.includes(target) ? '选择已有目录' : '创建并选中'}</button></div></form>}
  </div>;
}

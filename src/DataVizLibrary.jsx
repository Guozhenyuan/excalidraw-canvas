import React, { useEffect, useState } from 'react';
import { installDataViz, loadDataViz } from './dataViz';
export default function DataVizLibrary({ api, disabled, onOpen, onError }) {
  const [loading, setLoading] = useState(true), [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!api) return;
    let active = true;
    setLoading(true);
    loadDataViz().then(items => active && installDataViz(api, items))
      .then(() => { if (active) setFailed(false); })
      .catch(() => { if (active) setFailed(true); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [api]);
  async function open() {
    setLoading(true);
    try {
      await installDataViz(api, await loadDataViz(), true);
      setFailed(false); onOpen();
    } catch { setFailed(true); onError('Data Viz 素材加载失败，请点“重试素材库”。当前画布保存不受影响。'); }
    finally { setLoading(false); }
  }
  return <button onClick={open} disabled={disabled || !api || loading} title="Data Viz · 32 个可编辑图表素材" aria-label={failed ? '重试 Data Viz 素材库' : '打开 Data Viz 素材库'}>{loading ? '素材加载中…' : failed ? '重试素材库' : '素材库'}</button>;
}

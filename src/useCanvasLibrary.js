import { useMemo, useState } from 'react';
import { useHandleLibrary } from '@excalidraw/excalidraw';
import { libraryStore, mergeLibraryById } from './library';
import { loadDataViz } from './dataViz';

export function useCanvasLibrary(api) {
  const [loaded, setLoaded] = useState(false), [notice, setNotice] = useState('');
  const adapter = useMemo(() => {
    let readFailed = false;
    return {
      async load({ source }) {
        let data;
        try { data = await libraryStore.load(); }
        catch (error) {
          if (source !== 'load') throw error;
          readFailed = true;
          setNotice('浏览器无法读取本机素材库，本次添加仅保留在当前页面。可使用独立窗口重试。');
          data = { libraryItems: [] };
        }
        if (source === 'load') {
          try { data = { libraryItems: mergeLibraryById(data.libraryItems, await loadDataViz()) }; }
          catch { setNotice('内置 Data Viz 加载失败，可点击顶部“素材库”重试。'); }
          finally { setLoaded(true); }
        }
        return data;
      },
      async save(data) {
        if (readFailed) return; // Do not overwrite storage if its contents could not be read.
        try { await libraryStore.save(data); }
        catch (error) { setNotice('素材已添加到当前页面，但浏览器未能保存素材库；刷新前请在素材面板导出备份。'); throw error; }
      }
    };
  }, []);
  useHandleLibrary({ excalidrawAPI: api, adapter });
  return { loaded, notice };
}

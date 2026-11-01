import test from 'node:test';
import assert from 'node:assert/strict';
import { canAutoSave,createDrawingPath } from './autosave.js';
const ready={connected:true,dirty:true,busy:false,saving:false,paused:false,readonly:false,loaded:{sha:'known-version',path:'a.excalidraw',identity:'owner/repo@main'},path:'a.excalidraw',identity:'owner/repo@main'};
test('autosave requires the loaded file version; blank and renamed targets never write automatically',()=>{
 assert.equal(canAutoSave(ready),true);
 assert.equal(canAutoSave({...ready,loaded:null}),false);
 assert.equal(canAutoSave({...ready,loaded:{...ready.loaded,sha:null}}),false);
 assert.equal(canAutoSave({...ready,path:'new.excalidraw'}),false);
 assert.equal(canAutoSave({...ready,identity:'another/repo@main'}),false);
});
test('paused failures, read-only mode and in-flight operations block autosave',()=>{
 for(const key of ['paused','readonly','busy','saving'])assert.equal(canAutoSave({...ready,[key]:true}),false);
 for(const key of ['connected','dirty'])assert.equal(canAutoSave({...ready,[key]:false}),false);
});
test('new canvases use separate paths, including duplicate titles',()=>{
 assert.notEqual(createDrawingPath('研究计划','abcd1234'),createDrawingPath('研究计划','abcd1235'));
 assert.equal(createDrawingPath('../研究\\计划.excalidraw','abcd1234'),'drawings/..-研究-计划-abcd1234.excalidraw');
 assert.equal(createDrawingPath('','abcd1234'),'drawings/未命名画布-abcd1234.excalidraw');
});

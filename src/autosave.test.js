import test from 'node:test';
import assert from 'node:assert/strict';
import { canAutoSave } from './autosave.js';
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

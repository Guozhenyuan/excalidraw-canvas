import test from 'node:test';
import assert from 'node:assert/strict';
import { synchronizeRemote, retryDelay } from './sync.js';
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve}};
function fixture() {
 const events=[]; const loaded={path:'项目/图.excalidraw',sha:'old'};
 let state={allowed:true,context:{},epoch:0,loaded,clean:true,interacting:false};
 const repo={paths:[loaded.path],versions:{[loaded.path]:'new'},directories:['项目'],truncated:false};
 const options={read:()=>state,list:async()=>repo,version:async()=> 'new',load:async()=>({sha:'new',drawing:{elements:[]}}),publish:()=>events.push('list'),apply:async()=>events.push('apply'),conflict:()=>events.push('conflict'),missing:()=>events.push('missing')};
 return {events,options,repo,get state(){return state},set state(v){state=v}};
}
test('remote change updates a clean canvas, unchanged SHA avoids downloading the drawing',async()=>{
 const f=fixture();assert.equal(await synchronizeRemote(f.options),'updated');assert.deepEqual(f.events,['list','apply']);
 f.repo.versions[f.state.loaded.path]='old';f.options.load=()=>assert.fail('unchanged file must not download');assert.equal(await synchronizeRemote(f.options),'unchanged');
});
test('local edits made while downloading are preserved and reported as conflict',async()=>{
 const f=fixture(), download=pending();f.options.load=()=>download.promise;
 const job=synchronizeRemote(f.options);await Promise.resolve();await Promise.resolve();
 f.state={...f.state,clean:false};download.resolve({sha:'new',drawing:{}});
 assert.equal(await job,'conflict');assert.ok(!f.events.includes('apply'));
});
test('save, file switch, disconnect and toggle-off invalidate an in-flight response',async()=>{
 for(const change of [s=>({...s,epoch:1}),s=>({...s,loaded:{...s.loaded,path:'other.excalidraw'}}),s=>({...s,context:{}}),s=>({...s,allowed:false})]){
  const f=fixture(), response=pending();f.options.list=()=>response.promise;
  const job=synchronizeRemote(f.options);f.state=change(f.state);response.resolve(f.repo);
  assert.equal(await job,'stale');assert.deepEqual(f.events,[]);
 }
});
test('changes after metadata read but before drawing fetch also invalidate the response',async()=>{
 const f=fixture(), download=pending();f.options.load=()=>download.promise;const job=synchronizeRemote(f.options);
 await Promise.resolve();await Promise.resolve();f.state={...f.state,epoch:2};download.resolve({sha:'new'});
 assert.equal(await job,'stale');assert.ok(!f.events.includes('apply'));
});
test('local dirty content and active gestures never get replaced',async()=>{
 const f=fixture();f.state={...f.state,clean:false};assert.equal(await synchronizeRemote(f.options),'conflict');assert.ok(!f.events.includes('apply'));
 const g=fixture();g.state={...g.state,interacting:true};assert.equal(await synchronizeRemote(g.options),'deferred');assert.ok(!g.events.includes('apply'));
});
test('remote deletion is reported without clearing the canvas or writing a new file',async()=>{
 const f=fixture();f.repo.versions={};assert.equal(await synchronizeRemote(f.options),'missing');assert.deepEqual(f.events,['list','missing']);
});
test('truncated directory listings are checked before classifying missing files',async()=>{
 const f=fixture();f.repo.versions={};f.repo.truncated=true;assert.equal(await synchronizeRemote(f.options),'updated');assert.ok(!f.events.includes('missing'));
 f.options.version=async()=>{throw Object.assign(new Error('denied'),{status:403})};await assert.rejects(synchronizeRemote(f.options),/denied/);
});
test('directory-only synchronization works before opening a canvas',async()=>{
 const f=fixture();f.state={...f.state,loaded:null};assert.equal(await synchronizeRemote(f.options),'directory');assert.deepEqual(f.events,['list']);
});
test('network failures do not apply or delete content; retry delay respects server reset',async()=>{
 const f=fixture();f.options.list=async()=>{throw new TypeError('offline')};await assert.rejects(synchronizeRemote(f.options));assert.deepEqual(f.events,[]);
 assert.equal(retryDelay(1,0,1000),60000);assert.equal(retryDelay(10,0,1000),300000);assert.equal(retryDelay(1,901000,1000),900000);
});

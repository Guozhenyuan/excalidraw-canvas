import test from 'node:test';
import assert from 'node:assert/strict';
import { validateDirectory, newDirectoryPath, createDirectoryClient } from './directories.js';
const fail=status=>Object.assign(new Error('request failed'),{status});
test('new directory supports Chinese and nested names under root or a selected parent',()=>{
 assert.equal(newDirectoryPath('','研究/草稿'),'研究/草稿');assert.equal(newDirectoryPath('项目','  笔记  '),'项目/笔记');
 for(const name of ['', '..','a/../b','/root','a//b','a/','a\\b','.git/objects','a/ /b'])assert.throws(()=>validateDirectory(name));
});
test('a new directory is persisted using a non-drawing marker in the selected branch',async()=>{
 const calls=[];const create=createDirectoryClient({branch:'feature/draw',request:async(url,opts={})=>{calls.push({url,opts});if(!opts.method)throw fail(404);return {content:{sha:'marker'}}}});
 assert.deepEqual(await create('项目/新目录'),{path:'项目/新目录',existed:false});
 const write=calls.find(c=>c.opts.method==='PUT');assert.match(calls[0].url,/ref=feature%2Fdraw$/);assert.ok(write.url.endsWith('/.gitkeep'));
 const body=JSON.parse(write.opts.body);assert.equal(body.content,'');assert.equal(body.branch,'feature/draw');assert.equal(body.sha,undefined);assert.ok(write.url.includes(encodeURIComponent('新目录')));
});
test('existing directory is selected without writing or overwriting any marker',async()=>{
 let writes=0;const create=createDirectoryClient({branch:'main',request:async(url,opts={})=>{if(opts.method)writes++;return [{name:'drawing.excalidraw'}]}});
 assert.equal((await create('existing')).existed,true);assert.equal(writes,0);
});
test('same-name files and denied preflight requests never trigger a write',async()=>{
 for(const response of ['file',403]){let writes=0;const create=createDirectoryClient({branch:'main',request:async(url,opts={})=>{if(opts.method)writes++;if(response===403)throw fail(403);return {type:'file'}}});await assert.rejects(create('a'));assert.equal(writes,0);}
});
test('a lost creation response is checked without repeating PUT',async()=>{
 let created=false,writes=0;const create=createDirectoryClient({branch:'main',request:async(url,opts={})=>{if(opts.method==='PUT'){writes++;created=true;throw new TypeError('offline')}if(!created)throw fail(404);return [{name:'.gitkeep'}]}});
 const result=await create('test');assert.equal(result.recovered,true);assert.equal(writes,1);
});
test('concurrent creation succeeds without overwriting a marker',async()=>{
 let count=0;const create=createDirectoryClient({branch:'main',request:async(url,opts={})=>{count++;if(count===1)throw fail(404);if(opts.method==='PUT'){assert.equal(JSON.parse(opts.body).sha,undefined);throw fail(422)}return [{name:'.gitkeep'}]}});
 assert.equal((await create('test')).recovered,true);assert.equal(count,3);
});
test('unconfirmed creation errors remain errors and invalid names send no requests',async()=>{
 let calls=0;const create=createDirectoryClient({branch:'main',request:async(url,opts={})=>{calls++;if(opts.method)throw fail(500);throw fail(404)}});
 await assert.rejects(create('../bad'));assert.equal(calls,0);await assert.rejects(create('good'),e=>e.status===500);assert.equal(calls,3);
});
test('a file used as a parent path is rejected before creation',async()=>{
 let writes=0;const create=createDirectoryClient({branch:'main',request:async(url,opts={})=>{if(opts.method)writes++;if(url.includes('file/child'))throw fail(404);return {type:'file'}}});
 await assert.rejects(create('file/child'),/上级路径/);assert.equal(writes,0);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { createFileOperations } from './fileOperations.js';
import { validatePath } from './github.js';
function fixture({stale=false,collision=false,race=false,lost=false,truncated=false,mode='100644'}={}) {
 const calls=[];let applied=false;
 const request=async(path, options={})=>{
  const body=options.body?JSON.parse(options.body):null;calls.push({path,method:options.method||'GET',body});
  if(path==='/git/ref/heads/main')return {object:{sha:applied?'new-commit':race&&calls.some(c=>c.method==='PATCH')?'other-commit':'head'}};
  if(path==='/git/commits/head')return {tree:{sha:'root'}};
  if(path==='/git/trees/root')return {tree:[{path:'目录',type:'tree',sha:'subtree',mode:'040000'},{path:'README.md',type:'blob',sha:'keep',mode:'100644'}],truncated};
  if(path==='/git/trees/subtree')return {tree:[{path:'原稿.excalidraw',type:'blob',sha:stale?'changed':'blob',mode},...(collision?[{path:'新版.excalidraw',type:'blob',sha:'existing',mode:'100644'}]:[])]};
  if(path==='/git/trees'&&options.method==='POST')return {sha:'new-tree'};
  if(path==='/git/commits'&&options.method==='POST')return {sha:'new-commit'};
  if(path==='/git/refs/heads/main') {if(race)throw Object.assign(new Error('non fast forward'),{status:422});applied=true;if(lost)throw new TypeError('response lost');return {object:{sha:'new-commit'}};}
  if(path==='/compare/new-commit...other-commit')return {status:'diverged'};
  throw new Error('Unexpected request '+path);
 };
 return {calls,api:createFileOperations({request,branch:'main',validatePath})};
}
test('rename preserves the exact blob and file mode in one commit while retaining unrelated files',async()=>{
 const {api,calls}=fixture({mode:'100755'});const result=await api.rename('目录/原稿.excalidraw','目录/新版.excalidraw','blob');
 const tree=calls.find(c=>c.path==='/git/trees'&&c.method==='POST').body;
 assert.equal(tree.base_tree,'root');assert.deepEqual(tree.tree,[{path:'目录/原稿.excalidraw',mode:'100755',type:'blob',sha:null},{path:'目录/新版.excalidraw',mode:'100755',type:'blob',sha:'blob'}]);
 assert.deepEqual(calls.find(c=>c.method==='PATCH').body,{sha:'new-commit',force:false});
 assert.deepEqual(calls.find(c=>c.path==='/git/commits'&&c.method==='POST').body.parents,['head']);
 assert.equal(result.sha,'blob');assert.equal(calls.filter(c=>c.method==='PATCH').length,1);
});
test('delete removes only the selected version and records a single commit',async()=>{
 const {api,calls}=fixture();await api.remove('目录/原稿.excalidraw','blob');
 const changes=calls.find(c=>c.path==='/git/trees'&&c.method==='POST').body.tree;
 assert.deepEqual(changes,[{path:'目录/原稿.excalidraw',mode:'100644',type:'blob',sha:null}]);
});
test('stale files cannot be renamed or deleted',async()=>{
 for(const kind of ['rename','remove']){const{api,calls}=fixture({stale:true});await assert.rejects(kind==='rename'?api.rename('目录/原稿.excalidraw','目录/新版.excalidraw','blob'):api.remove('目录/原稿.excalidraw','blob'),/变化/);assert.ok(calls.every(c=>c.method==='GET'));}
});
test('rename never replaces an existing destination',async()=>{
 const{api,calls}=fixture({collision:true});await assert.rejects(api.rename('目录/原稿.excalidraw','目录/新版.excalidraw','blob'),/同名/);assert.ok(calls.every(c=>c.method==='GET'));
});
test('concurrent branch updates are rejected without force or automatic retry',async()=>{
 const{api,calls}=fixture({race:true});await assert.rejects(api.remove('目录/原稿.excalidraw','blob'),/变化/);assert.equal(calls.filter(c=>c.method==='PATCH').length,1);assert.equal(calls.find(c=>c.method==='PATCH').body.force,false);
});
test('lost successful ref response is verified without repeating the mutation',async()=>{
 const{api,calls}=fixture({lost:true});const result=await api.rename('目录/原稿.excalidraw','目录/新版.excalidraw','blob');assert.equal(result.commit,'new-commit');assert.equal(calls.filter(c=>c.method==='PATCH').length,1);
});
test('truncated trees and symbolic links are refused before any write',async()=>{
 for(const options of [{truncated:true},{mode:'120000'}]){const{api,calls}=fixture(options);await assert.rejects(api.remove('目录/原稿.excalidraw','blob'));assert.ok(calls.every(c=>c.method==='GET'));}
});
test('invalid paths, missing versions and unchanged names do not reach GitHub',async()=>{
 const{api,calls}=fixture();await assert.rejects(api.remove('../x.excalidraw','blob'));await assert.rejects(api.remove('a.excalidraw'));await assert.rejects(api.rename('a.excalidraw','a.excalidraw','blob'));assert.equal(calls.length,0);
});

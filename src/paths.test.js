import test from 'node:test';
import assert from 'node:assert/strict';
import { drawingPath, directoryChoices, parseGithubLocation } from './paths.js';
const config={owner:'MyUser',repo:'drawings',branch:'main'};
test('chosen directory and exact Chinese name are preserved without random suffix',()=>{
 assert.equal(drawingPath('项目/研究','流程草稿'),'项目/研究/流程草稿.excalidraw');
 assert.equal(drawingPath('','我的画布.excalidraw'),'我的画布.excalidraw');
 assert.equal(drawingPath('项目','  设计.EXCALIDRAW  '),'项目/设计.excalidraw');
 for(const name of ['', '../秘密', 'a/b', 'a\\b']) assert.throws(()=>drawingPath('',name));
});
test('directory selector includes root, non-drawing directories and nested ancestors',()=>{
 const choices=directoryChoices(['资料/图片'],['项目/研究/a.excalidraw'],'新目录');
 for(const dir of ['', '资料','资料/图片','项目','项目/研究','新目录'])assert.ok(choices.includes(dir));
 assert.equal(choices.filter(d=>d==='项目').length,1);
});
test('GitHub file and folder links locate only the connected repository and branch',()=>{
 assert.deepEqual(parseGithubLocation('https://github.com/myuser/drawings/blob/main/项目/图稿.excalidraw',config),{directory:'项目',filename:'图稿.excalidraw'});
 assert.deepEqual(parseGithubLocation('https://github.com/MyUser/drawings/tree/main/项目/',config),{directory:'项目',filename:''});
 assert.deepEqual(parseGithubLocation('https://github.com/MyUser/drawings',config),{directory:'',filename:''});
 assert.deepEqual(parseGithubLocation('https://github.com/MyUser/drawings/tree/feature/test/项目',{...config,branch:'feature/test'}),{directory:'项目',filename:''});
 for(const url of ['https://evil.example/myuser/drawings/tree/main','https://github.com/myuser/other/tree/main','https://github.com/myuser/drawings/tree/other','https://github.com/myuser/drawings/blob/main/readme.md','https://github.com/myuser/drawings/tree/main?token=secret']) assert.throws(()=>parseGithubLocation(url,config));
});

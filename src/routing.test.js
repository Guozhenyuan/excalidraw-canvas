import test from 'node:test';
import assert from 'node:assert/strict';
import { canvasURL, readRoute } from './routing.js';
const base = 'https://guozhenyuan.github.io/excalidraw-canvas/';
test('different private drawings have distinct stable links with Unicode paths', () => {
 const first=canvasURL(base,{file:'项目A/思考.excalidraw'}), second=canvasURL(base,{file:'项目B/思考.excalidraw'});
 assert.notEqual(first,second); assert.equal(readRoute(first).file,'项目A/思考.excalidraw'); assert.equal(canvasURL(first,readRoute(first)),first);
});
test('routing removes secrets and unrelated parameters', () => {
 const url=canvasURL(base+'?token=SECRET&file=a.excalidraw#SECRET',readRoute(base+'?token=SECRET&file=a.excalidraw#SECRET'));
 assert.equal(url,base+'?file=a.excalidraw'); assert.ok(!url.includes('SECRET'));
});
test('custom repository branch and readonly mode survive link round trip', () => {
 const route={file:'canvas.excalidraw',owner:'another-owner',repo:'private-art',branch:'draft/drawings',readonly:true};
 assert.deepEqual(readRoute(canvasURL(base,route)),route);
});

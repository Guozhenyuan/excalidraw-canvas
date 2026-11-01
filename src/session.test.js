import test from 'node:test';
import assert from 'node:assert/strict';
import { validConnection } from './session.js';
const expected = { owner:'Guozhenyuan',repo:'excalidraw-drawings',branch:'main' };
const saved = { ...expected,token:'github_pat_TEST_ONLY',expiresAt:2000 };
test('remembered connection restores only before expiry and for the exact repository and branch',()=>{
 assert.equal(validConnection(saved,expected,1000),true);
 assert.equal(validConnection(saved,expected,2000),false);
 for(const key of ['owner','repo','branch'])assert.equal(validConnection(saved,{...expected,[key]:'other'},1000),false);
});
test('missing or malformed remembered credentials never connect',()=>{
 for(const candidate of [null,{}, {...saved,token:'wrong'}, {...saved,expiresAt:Infinity}])assert.equal(validConnection(candidate,expected,1000),false);
});

import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {gzipSync} from 'node:zlib';
const handler=createRequire(import.meta.url)('../api/ella-access.js');
const sets=JSON.parse(fs.readFileSync(process.env.ELLA_EXAMPLE_TEST_DATA||'../private-ella/examples.json','utf8'));
const key='local-test-only-012345678901234567890123456789';
process.env.ELLA_SESSION_SECRET='test-only-session-secret-012345678901234567890123456789';
process.env.ELLA_ACCESS_KEY_SHA256=createHash('sha256').update(key).digest('hex');
process.env.ELLA_EXAMPLES_GZIP=gzipSync(Buffer.from(JSON.stringify(sets))).toString('base64');
async function call(method,headers={},body){
 const r={headers:{},setHeader(k,v){this.headers[k]=v},status(n){this.code=n;return this},json(v){this.body=v;return this}};
 await handler({method,headers,body},r);return r;
}
assert.equal((await call('GET')).code,401);
assert.equal((await call('POST',{'content-type':'application/json',origin:'https://wrong.test'},{key})).code,403);
assert.equal((await call('POST',{'content-type':'application/json',origin:'https://ella-voca.vercel.app'},{key:'wrong'})).code,401);
const unlocked=await call('POST',{'content-type':'application/json',origin:'https://ella-voca.vercel.app'},{key});
assert.equal(unlocked.code,200);
assert.match(unlocked.headers['Set-Cookie'],/HttpOnly; Secure; SameSite=Strict/);
const cookie=unlocked.headers['Set-Cookie'].split(';')[0];
const allowed=await call('GET',{cookie});assert.equal(allowed.code,200);assert.equal(allowed.body.sets.length,20);
assert.equal(allowed.headers['Cache-Control'],'private, no-store, max-age=0');
assert.equal((await call('GET',{cookie:cookie+'invalid'})).code,401);
const pub=JSON.parse(fs.readFileSync(new URL('../data/vocabulary.json',import.meta.url),'utf8'));
assert(pub.sets.every(s=>s.words.every(w=>!w.exampleEn&&!w.exampleKo)));
assert(!fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8').includes("'/api/ella-access'"));
console.log('Private API passed: unauthorized and tampered cookies rejected, valid session allowed, no public example data/cache.');

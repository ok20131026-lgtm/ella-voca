import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=fs.readFileSync(new URL('../sw.js',import.meta.url),'utf8');
const handlers={},removed=[];let installed=[],claimed=false,skipped=false;
const cache={addAll:async requests=>{installed=requests;},match:async path=>path==='/app.js'?{cached:true}:undefined};
const caches={open:async()=>cache,keys:async()=>['other-app','ella-voca-old','ella-voca-android-20260918-1'],delete:async k=>{removed.push(k);}};
const self={location:{origin:'https://ella.test'},clients:{claim:async()=>{claimed=true;}},skipWaiting:()=>{skipped=true;},addEventListener:(t,f)=>handlers[t]=f};
class Request{constructor(url,options){this.url=url;this.cache=options.cache;}}
vm.runInNewContext(code,{self,caches,URL,Request,fetch:async()=>({network:true})});
let waiting;
handlers.install({waitUntil:p=>waiting=p});await waiting;
assert.equal(installed.length,9);assert.ok(installed.every(r=>r.cache==='reload'));
for(const item of installed){if(item.url!=='/')assert.ok(fs.existsSync(new URL('..'+item.url,import.meta.url)),item.url);}
handlers.activate({waitUntil:p=>waiting=p});await waiting;
assert.deepEqual(removed,['ella-voca-old']);assert.equal(claimed,true);assert.equal(skipped,false);
handlers.message({data:{type:'SKIP_WAITING'}});assert.equal(skipped,true);
let response;
handlers.fetch({request:{url:'https://ella.test/app.js',method:'GET'},respondWith:p=>response=p});
assert.equal((await response).cached,true);
response=undefined;handlers.fetch({request:{url:'https://outside.test/app.js',method:'GET'},respondWith:p=>response=p});assert.equal(response,undefined);
console.log('Offline worker passed: asset install, version cleanup, cached response, explicit activation.');

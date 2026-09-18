import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const block=source.slice(source.indexOf('  function legacyCopy('),source.indexOf('  function notifyUser('));
async function run(clipboard,legacyResult){
  const nodes={},messages=[];let legacyCalls=0;
  const document={
    getElementById:id=>nodes[id],
    createElement:()=>({setAttribute(){},remove(){delete nodes['copy-dialog'];delete nodes['copy-url'];}}),
    body:{appendChild:node=>{nodes[node.id]=node;nodes['copy-url']={value:'https://ella-voca.vercel.app/',focus(){},select(){},setSelectionRange(){}};}},
    execCommand:()=>{legacyCalls++;return legacyResult;}
  };
  const api=new Function('document','navigator','location','notifyUser','escapeHtml',block+'return {copyAppLink};')(document,{clipboard},{href:'https://ella-voca.vercel.app/'},m=>messages.push(m),s=>s);
  await api.copyAppLink();return {nodes,messages,legacyCalls};
}
let copied;
let r=await run({writeText:async text=>{copied=text;}},false);
assert.equal(copied,'https://ella-voca.vercel.app/');assert.equal(r.messages[0],'링크를 복사했습니다.');assert.equal(r.legacyCalls,0);
r=await run(undefined,true);assert.equal(r.legacyCalls,1);assert.equal(r.messages[0],'링크를 복사했습니다.');assert.equal(r.nodes['copy-dialog'],undefined);
r=await run({writeText:async()=>{throw Error('denied');}},true);assert.equal(r.messages[0],'링크를 복사했습니다.');
r=await run({writeText:async()=>{throw Error('denied');}},false);assert.ok(r.nodes['copy-dialog']);assert.equal(r.messages.length,0,'must not claim copy success if both APIs fail');
console.log('Clipboard passed: modern API, missing/denied fallback, honest failure and visible manual-copy dialog.');

import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const data=JSON.parse(fs.readFileSync(new URL('../data/vocabulary.json',import.meta.url),'utf8'));
function boot(mem={}){
  const events={},windowEvents={},nodes={app:{innerHTML:''},'stage-slot':{innerHTML:''}},timers=new Map();let id=0,time=1000;
  const document={hidden:false,getElementById:k=>nodes[k],body:{classList:{toggle(){}}},addEventListener:(t,f,c)=>{(events[t]??=[]).push({f,c});}};
  const window={localStorage:{getItem:k=>mem[k]||null,setItem:(k,v)=>mem[k]=v},addEventListener:(t,f)=>windowEvents[t]=f};
  const nav=[],history={pushState:s=>nav.push(s),replaceState:s=>{nav[nav.length?nav.length-1:0]=s;}};
  const navigator={vibrate(){}};
  const instrumented=source.replace('  init();',`  return init().then(()=>({state:()=>({screen,stage,index,drawerOpen,stage3Selected,stage3Locked,testIndex,testSelected,testQuestions,testAnswers}),saveSession,restoreSession,validBackup,getStudy,getTest,pendingWords,render,stopMedia}));`);
  const apiPromise=new Function('document','window','navigator','location','fetch','setTimeout','clearTimeout','confirm','alert','history','Date','return '+instrumented)(document,window,navigator,{href:'https://example.test'},async()=>({ok:true,json:async()=>data}),f=>{timers.set(++id,f);return id;},id=>timers.delete(id),()=>true,()=>{},history,{now:()=>time});
  return apiPromise.then(api=>({api,mem,nav,document,events,windowEvents,nodes,timers,
    click(dataset,advance=true){if(advance)time+=500;const e={target:{closest:()=>({dataset})},preventDefault(){},stopPropagation(){}};events.click.filter(x=>x.c!==true).forEach(x=>x.f(e));},
    flush(){const ts=[...timers.values()];timers.clear();ts.forEach(f=>f());}
  }));
}
const b=await boot();const {api}=b;
b.click({action:'open-study'});b.click({stage:'2'});
b.click({next2:''});assert.equal(api.state().index,1);
b.click({next2:''},false);assert.equal(api.state().index,1,'rapid second next must be ignored');
const resumed=await boot(b.mem);resumed.click({action:'resume-session'});
assert.equal(resumed.api.state().stage,2);assert.equal(resumed.api.state().index,1);
assert.equal(resumed.api.getStudy(data.sets[0].setId).stage2[data.sets[0].words[0].word].correct,false);
b.click({action:'open-drawer'});assert.equal(b.nav.at(-1).drawerOpen,true);
b.windowEvents.popstate({state:{ella:true,screen:'study',drawerOpen:false}});assert.equal(api.state().drawerOpen,false);
b.windowEvents.popstate({state:{ella:true,screen:'home',drawerOpen:false}});assert.equal(api.state().screen,'home');
b.click({testSet:data.sets[0].setId});let q=api.state().testQuestions[0];b.click({testChoice:q.word.word});
const testResume=await boot(b.mem);testResume.click({action:'resume-session'});
assert.equal(testResume.api.state().screen,'testQuiz');assert.equal(testResume.api.state().testSelected,q.word.word);assert.equal(testResume.api.state().testAnswers.length,1);
testResume.click({testChoice:q.word.word});assert.equal(testResume.api.state().testAnswers.length,1,'restored answered question cannot score twice');
b.click({action:'open-study'});b.click({stage:'3'});
const saved=JSON.parse(b.mem['ella-voca-session-v1']);const word=data.sets[0].words[0];const bank=[...saved.stage3Banks[word.word]];
for(const ch of word.word.replace(/[^a-z]/g,'')){const i=bank.findIndex(x=>x.ch===ch);b.click({letter:String(bank.splice(i,1)[0].id)});}
assert.equal(api.state().stage3Locked,true);b.document.hidden=true;b.events.visibilitychange.forEach(x=>x.f());
b.flush();assert.equal(api.state().index,0,'backgrounded app must not auto-advance');assert.equal(api.state().stage3Locked,false);
const correctResume=await boot(b.mem);correctResume.click({action:'resume-session'});assert.equal(correctResume.api.state().stage3Locked,false);
assert.equal(api.validBackup({app:'ella-voca',version:1,study:{},test:{}}),true);
assert.equal(api.validBackup({app:'ella-voca',version:1,study:{bad:{}},test:{}}),false);
assert.equal(api.validBackup({app:'ella-voca',version:1,study:{},test:{[data.sets[0].setId]:{best:99,wrong:[]}}}),false);
const manifest=JSON.parse(fs.readFileSync(new URL('../manifest.webmanifest',import.meta.url),'utf8'));
assert.equal(manifest.display,'standalone');assert.equal(manifest.icons.length,3);
console.log('Android regression passed: rapid taps, study/test restoration, immutable scores, Back, background timer, backup validation, manifest.');

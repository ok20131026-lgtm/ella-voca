import fs from 'node:fs';
import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const data=JSON.parse(fs.readFileSync(new URL('../data/vocabulary.json',import.meta.url),'utf8'));
const privateSets=JSON.parse(fs.readFileSync(process.env.ELLA_EXAMPLE_TEST_DATA || '../private-ella/examples.json','utf8'));
for(const set of data.sets) for(const word of set.words) Object.assign(word,privateSets.find(s=>s.setId===set.setId).words.find(w=>w.word===word.word));
function boot(mem={}){
  const events={},windowEvents={},nodes={app:{innerHTML:''},'stage-slot':{innerHTML:''}},timers=new Map();let id=0,time=1000,confirmed=true;
  const document={hidden:false,getElementById:k=>nodes[k],body:{classList:{toggle(){}}},addEventListener:(t,f,c)=>{(events[t]??=[]).push({f,c});}};
  const window={localStorage:{getItem:k=>mem[k]||null,setItem:(k,v)=>mem[k]=v},addEventListener:(t,f)=>windowEvents[t]=f};
  const nav=[],history={pushState:s=>nav.push(s),replaceState:s=>{nav[nav.length?nav.length-1:0]=s;}};
  const navigator={vibrate(){}};
  const instrumented=source.replace('  init();',`  return init().then(()=>({state:()=>({screen,stage,index,flipped,stage3Feedback,drawerOpen,stage3Selected,stage3Locked,testIndex,testSelected,testQuestions,testAnswers,testMode}),saveSession,restoreSession,buildTest,startTest,renderTestQuiz,validBackup,getStudy,getTest,pendingWords,render,stopMedia}));`);
  const apiPromise=new Function('document','window','navigator','location','fetch','setTimeout','clearTimeout','confirm','alert','history','Date','return '+instrumented)(document,window,navigator,{href:'https://example.test'},async()=>({ok:true,json:async()=>data}),f=>{timers.set(++id,f);return id;},id=>timers.delete(id),()=>confirmed,()=>{},history,{now:()=>time});
  return apiPromise.then(api=>({api,mem,nav,document,events,windowEvents,nodes,timers,confirm(value){confirmed=value;},
    click(dataset,advance=true){if(advance)time+=500;const e={target:{closest:()=>({dataset})},preventDefault(){},stopPropagation(){}};events.click.filter(x=>x.c!==true).forEach(x=>x.f(e));},
    flush(){const ts=[...timers.values()];timers.clear();ts.forEach(f=>f());}
  }));
}

const b=await boot();b.click({action:'open-example'});
assert.equal(b.api.state().testMode,'example');
for(let si=0;si<data.sets.length;si++){
 const set=data.sets[si];b.click({testSet:set.setId});
 const qs=b.api.state().testQuestions, positions=[0,0,0,0];
 assert.equal(qs.length,15);
 for(const q of qs){
  assert(q.word.exampleEn&&q.word.exampleKo&&q.word.exampleBlank.includes('______'));
  assert.equal(new Set(q.choices.map(w=>w.word)).size,4);
  assert.equal(q.choices.filter(w=>w.word===q.word.word).length,1);
  positions[q.choices.findIndex(w=>w.word===q.word.word)]++;
 }
 assert.deepEqual(positions.toSorted(),[3,4,4,4]);
 for(let i=0;i<15;i++){
  const q=b.api.state().testQuestions[i];assert(!b.nodes.app.innerHTML.includes(q.word.exampleKo),'translation hidden');
  b.click({action:'toggle-hint'});assert(b.nodes.app.innerHTML.includes('[예문 해석]'),'Korean example hint label');
  assert(b.nodes.app.innerHTML.includes(q.word.exampleKo.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))),'hint uses Excel translation');
  b.click({action:'toggle-hint'});assert(!b.nodes.app.innerHTML.includes('[예문 해석]'),'hint can be closed');
  b.click({testChoice:q.word.word});assert(b.nodes.app.innerHTML.includes(q.word.exampleKo.replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]))),q.word.word);
  b.click({action:'next-test'});
 }
 assert.equal(b.api.state().screen,'testResult');assert.equal(b.api.getTest(set.setId).best,15);
}
assert.equal(Object.keys(JSON.parse(b.mem['ella-voca-example-test-v1'])).length,20);
assert(!b.mem['ella-voca-test-v1'],'definition scores remain separate');
b.click({testSet:data.sets[0].setId});let q=b.api.state().testQuestions[0];
b.click({testChoice:q.choices.find(w=>w.word!==q.word.word).word});b.flush();assert.equal(b.api.state().testIndex,0,'wrong answer never auto-advances');
const restored=await boot(b.mem);restored.click({action:'open-example'});restored.click({action:'resume-example'});
assert.equal(restored.api.state().testMode,'example');assert.equal(restored.api.state().testSelected,b.api.state().testSelected);
assert.deepEqual(restored.api.state().testQuestions,b.api.state().testQuestions);
restored.click({action:'next-test'});q=restored.api.state().testQuestions[1];restored.click({testChoice:q.word.word});
restored.flush();assert.equal(restored.api.state().testIndex,1,'correct answer stays until next button, same as definition test');
restored.click({action:'next-test'});
q=restored.api.state().testQuestions[2];restored.click({testChoice:q.word.word});restored.click({action:'next-test'});restored.flush();assert.equal(restored.api.state().testIndex,3,'manual next cancels timer');
q=restored.api.state().testQuestions[3];restored.click({testChoice:q.word.word});restored.click({action:'go-home'});restored.flush();assert.equal(restored.api.state().screen,'home');
assert(data.sets[16].words[0].exampleBlank.includes("8 o'clock"),'do not blank unrelated clock in o’clock');
assert.equal(data.sets[4].words[11].exampleBlank.split('______').length-1,2,'separated idiom has two blanks');
assert.equal(data.sets[18].words[5].exampleBlank.split('______').length-1,2,'axis appears twice');
assert.equal(restored.api.validBackup({app:'ella-voca',version:1,study:{},test:{[data.sets[0].setId]:{best:99,wrong:[]}},example:{[data.sets[0].setId]:{best:2,wrong:[]}}}),false);
console.log('Example quiz passed: all 300 questions, Excel Korean hints, 20 lessons, balanced positions, separate scores, hidden translations, persisted choices and answers, manual next, source forms and legacy vocabulary.');

const escape=v=>String(v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const mode of ['definition','example']){
 const t=await boot();const open=mode==='example'?'open-example':'open-test';
 t.click({action:open});t.click({testSet:data.sets[0].setId});
 let q=t.api.state().testQuestions[0];
 t.click({action:'toggle-hint'});
 assert(t.nodes.app.innerHTML.includes(escape(mode==='example'?q.word.exampleKo:q.word.definitionKo)),'source translation hint');
 assert(!t.nodes.app.innerHTML.includes('[힌트] 알파벳'),'old hint removed');
 t.click({testChoice:q.word.word});
 for(const choice of q.choices) assert(t.nodes.app.innerHTML.includes(escape(choice.meaningKo)),'all choices reveal Korean meaning');
 t.click({action:'next-test'});t.click({action:'go-testMenu'});
 assert(t.nodes.app.innerHTML.includes('이어 풀기 (2/15)'));
 const current=t.api.state().testQuestions;
 t.click({testSet:data.sets[1].setId});t.click({action:'next-test'});
 assert.equal(t.api.state().testIndex,1);
 assert.equal(t.api.state().testAnswers[0].skipped,true);
 t.click({action:'go-testMenu'});t.click({testSet:data.sets[0].setId});
 assert.equal(t.api.state().testIndex,1);assert.deepEqual(t.api.state().testQuestions,current);
 t.click({action:'go-testMenu'});
 const reload=await boot(t.mem);reload.click({action:open});reload.click({testSet:data.sets[0].setId});
 assert.equal(reload.api.state().testIndex,1,'Lesson resume after reload');
 reload.click({action:'go-testMenu'});reload.confirm(false);reload.click({resetTest:data.sets[0].setId});
 reload.click({testSet:data.sets[0].setId});assert.equal(reload.api.state().testIndex,1,'cancelled reset preserves position');
 reload.click({action:'go-testMenu'});reload.confirm(true);reload.click({resetTest:data.sets[0].setId});
 reload.click({testSet:data.sets[0].setId});assert.equal(reload.api.state().testIndex,0,'confirmed reset starts at first question');
 reload.click({action:'go-testMenu'});reload.click({testSet:data.sets[1].setId});assert.equal(reload.api.state().testIndex,1,'other lesson remains');
 reload.click({action:'go-testMenu'});reload.click({testSet:data.sets[0].setId});
 for(let i=0;i<15;i++)reload.click({action:'next-test'});
 assert.equal(reload.api.state().screen,'testResult');assert.equal(reload.api.state().testAnswers.length,15);
 assert(reload.api.state().testAnswers.every(a=>a.correct===false&&a.skipped));
 assert.equal(reload.api.getTest(data.sets[0].setId).wrong.length,15);
 assert(reload.nodes.app.innerHTML.includes('점수 0점'),'15 unanswered questions score zero');
}
console.log('Both test modes passed: per-Lesson resume/reload, source hint, all four meanings, confirmed/cancelled isolated reset, skips including final question count as wrong.');

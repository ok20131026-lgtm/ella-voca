import fs from 'node:fs';
const source=fs.readFileSync(new URL('../app.js',import.meta.url),'utf8');
const data=JSON.parse(fs.readFileSync(new URL('../data/vocabulary.json',import.meta.url),'utf8'));

async function runAudit(source,data){
  let handler;const nodes={app:{innerHTML:''},'stage-slot':{innerHTML:''}};
  const mem={},timers=new Map();let timerId=0;
  const document={getElementById:id=>nodes[id],body:{classList:{toggle(){}}},addEventListener:(type,fn,options)=>{if(type==='click'&&options!==true)handler=fn;}};
  const storage={getItem:k=>mem[k]||null,setItem:(k,v)=>{mem[k]=v;}};
  const window={localStorage:storage,addEventListener(){}};
  const timeout=(fn,ms)=>{timers.set(++timerId,{fn,ms});return timerId;};
  const clear=id=>timers.delete(id);
  const instrumented=source.replace('  init();','  return init().then(()=>({get:()=>({screen,index,stage,currentSet,testQuestions,testIndex,reviewWords,stage3Banks,stage3Selected,stage3Locked}),select:(set,st,i)=>{currentSet=set;stage=st;resetStudyNav();index=i;screen="study";renderStudy();},progress,pendingWords,getStudy,getTest,unlock:()=>{inputUntil=0;}}));');
  const api=await new Function('document','window','navigator','location','fetch','setTimeout','clearTimeout','confirm','alert','return '+instrumented)(
    document,window,{}, {href:'https://ella-voca.vercel.app/'},async()=>({ok:true,json:async()=>data}),timeout,clear,()=>true,()=>{});
  const results=[];function check(ok,label){if(!ok)throw Error(label);results.push(label);}
  const click=dataset=>{api.unlock();return handler({target:{closest:()=>({dataset})},preventDefault(){},stopPropagation(){}});};
  const flush=()=>{const pending=[...timers.values()];timers.clear();pending.forEach(t=>t.fn());};
  const set=data.sets[0],word=set.words[0].word,other=set.words[1].word;
  click({action:'open-study'});click({mark:'memorized'});check(api.progress(set).s1===1,'암기 수 저장');
  click({mark:'review'});check(api.progress(set).s1===0&&api.pendingWords().length===1,'암기·복습 상태 배타적');
  click({action:'start-review'});click({mark:'memorized'});check(api.pendingWords().length===0,'1단계 복습 해제');
  click({stage:'2'});click({choice2:other});
  check(api.progress(set).s2===0,'2단계 오답은 정답 수에 미포함');
  click({choice2:word});check(!api.getStudy(set.setId).stage2[word].correct,'최초 답안 불변');
  click({next2:''});click({next2:''});check(api.getStudy(set.setId).stage2[other].answered&&!api.getStudy(set.setId).stage2[other].correct,'건너뛰기 오답');
  click({action:'start-review'});click({choice2:word});
  check(!api.getStudy(set.setId).stage2[word].correct&&api.getStudy(set.setId).stage2[word].reviewed,'2단계 복습은 최초 점수 보존');
  click({stage:'3'});check(api.pendingWords().length===0,'단계별 오답 분리');
  click({next3:''});check(api.progress(set).s3===0,'3단계 건너뛰기 정답 수 유지');
  click({action:'start-review'});
  function spell(correct=true){
    const q=api.get(),w=(q.reviewWords||q.currentSet.words)[q.index];
    let bank=[...q.stage3Banks[w.word]];
    const target=w.word.toLowerCase().replace(/[^a-z]/g,'');
    let chars=target.split('');if(!correct)chars.reverse();
    for(const ch of chars){const at=bank.findIndex(b=>b.ch===ch);click({letter:String(bank.splice(at,1)[0].id)});}
  }
  spell();check(api.getStudy(set.setId).stage3[word].reviewed&&!api.getStudy(set.setId).stage3[word].correct,'3단계 복습 점수·목록 분리');
  click({action:'go-home'});flush();check(api.get().screen==='home'&&nodes.app.innerHTML.includes('home-screen'),'홈 이동 시 자동 이동 취소');
  api.select(set,3,2);spell(false);click({next3:''});flush();check(api.get().index===3,'오답 입력 초기화 타이머 이동 후 취소');
  api.select(set,3,4);spell();click({deleteLetter:''});check(api.get().stage3Locked,'정답 대기 중 입력 잠금');flush();
  check(api.get().index===5,'정답 자동 다음 문제');
  mem['ella-voca-test-v1']=JSON.stringify({[set.setId]:{best:9,wrong:[word,other]}});
  click({action:'reset-set'});check(api.getTest(set.setId).best===9&&api.getTest(set.setId).wrong.length===2,'학습 초기화가 시험 기록 보존');
  click({savedWrong:set.setId});check(nodes.app.innerHTML.includes(word)&&nodes.app.innerHTML.includes('details'),'저장된 시험 오답 개별 확인');
  click({action:'retry-wrong'});check(api.get().testQuestions.length===2,'저장된 시험 오답만 출제');
  click({action:'toggle-hint'});check(!nodes.app.innerHTML.includes('한글 뜻:')&&!nodes.app.innerHTML.includes('[해석]'),'시험 힌트에 뜻·해석 미노출');
  const q=api.get().testQuestions[0];click({testChoice:q.word.word});check(!api.getTest(set.setId).wrong.includes(q.word.word),'시험 복습 정답 즉시 오답 제거');
  click({action:'go-testMenu'});check(api.getTest(set.setId).wrong.length===1,'시험 중단 시 미풀이 오답 유지');
  click({savedWrong:set.setId});click({action:'retry-wrong'});click({testChoice:api.get().testQuestions[0].word.word});click({action:'next-test'});
  check(api.getTest(set.setId).best===9,'오답 복습 최고점 오염 방지');
  check(nodes.app.innerHTML.includes('점수 100점'),'시험 결과 백분율');
  click({testSet:set.setId});check(api.get().testQuestions.length===15,'전체 시험 15문항');
  for(let i=0;i<15;i++){click({testChoice:api.get().testQuestions[api.get().testIndex].word.word});click({action:'next-test'});}
  check(api.getTest(set.setId).best===15&&api.getTest(set.setId).wrong.length===0,'전체 시험 최고점·오답 저장');
  function noNested(html){let depth=0;for(const m of html.matchAll(/<\/?button\b[^>]*>/g)){if(m[0].startsWith('</'))depth--;else{if(depth!==0)return false;depth++;}if(depth<0)return false;}return depth===0;}
  let renders=0;
  for(const lesson of data.sets){
    for(let i=0;i<lesson.words.length;i++){
      for(const st of [1,2,3]){
        api.select(lesson,st,i);
        if(st===1)click({action:'flip-card'});
        const html=nodes['stage-slot'].innerHTML;
        check(noNested(html),'중첩 버튼 없음 '+lesson.setId+'/'+i+'/'+st);renders++;
        if(st===3){
          const buttons=[...html.matchAll(/data-letter="(\d+)"[^>]*>([a-z])<\/button>/g)].map(m=>m[2]).sort().join('');
          check(buttons===lesson.words[i].word.toLowerCase().replace(/[^a-z]/g,'').split('').sort().join(''),'알파벳 개수·중복 보존 '+lesson.setId+'/'+i);
        }
      }
    }
    click({testSet:lesson.setId});
    for(let i=0;i<15;i++){
      check(noNested(nodes.app.innerHTML),'시험 중첩 버튼 없음 '+lesson.setId+'/'+i);
      const q=api.get().testQuestions[i];check(q.choices.length===4&&new Set(q.choices.map(w=>w.word)).size===4,'4지선다 중복 없음 '+lesson.setId+'/'+i);
      click({testChoice:q.word.word});click({action:'next-test'});
    }
  }
  return {checks:results.length,studyRenders:renders,lessons:data.sets.length,words:data.sets.reduce((a,s)=>a+s.words.length,0)};
}

console.log('Regression checks:',await runAudit(source,data));


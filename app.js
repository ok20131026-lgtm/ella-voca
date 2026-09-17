(() => {
  'use strict';

  const app = document.getElementById('app');
  let DATA = null;
  let screen = 'home';
  let dark = false;
  let currentSet = null;
  let stage = 1;
  let drawerOpen = false;
  let index = 0;
  let flipped = false;
  let stage2Choices = {};
  let stage3Banks = {};
  let stage3Selected = [];
  let stage3Timer = null;
  let testSet = null;
  let testQuestions = [];
  let testIndex = 0;
  let testSelected = null;
  let testHint = false;
  let testAnswers = [];
  let cachedVoices = [];
  let audioCtx = null;

  const STUDY_KEY = 'ella-voca-study-v1';
  const TEST_KEY = 'ella-voca-test-v1';
  const DARK_KEY = 'ella-voca-dark';

  function escapeHtml(v='') {
    return String(v).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }

  function definitionHtml(text='') {
    const parts = String(text).split(/(\[[^\]]+\])/g);
    return parts.map(p => p.startsWith('[') && p.endsWith(']')
      ? `<strong class="definition-keyword">${escapeHtml(p.slice(1,-1))}</strong>`
      : escapeHtml(p)).join('');
  }

  function normalizeAnswer(v='') { return String(v).toLowerCase().replace(/[^a-z]/g, ''); }
  function shuffle(items) {
    const out = [...items];
    for (let i=out.length-1;i>0;i--) { const j=Math.floor(Math.random()*(i+1)); [out[i],out[j]]=[out[j],out[i]]; }
    return out;
  }

  function storage() {
    try { return window.localStorage; } catch(e) { try { return window.sessionStorage; } catch { return null; } }
  }
  function readAll(key) { const s=storage(); if(!s) return {}; try { return JSON.parse(s.getItem(key)||'{}'); } catch { return {}; } }
  function writeAll(key,obj) { const s=storage(); if(!s) return; try { s.setItem(key,JSON.stringify(obj)); } catch {} }
  function getStudy(setId) { const a=readAll(STUDY_KEY); return a[setId] || {stage1:{},stage2:{},stage3:{}}; }
  function saveStudy(setId,rec) { const a=readAll(STUDY_KEY); a[setId]=rec; writeAll(STUDY_KEY,a); }
  function getTest(setId) { const a=readAll(TEST_KEY); return a[setId] || {best:0,wrong:[]}; }
  function saveTest(setId,rec) { const a=readAll(TEST_KEY); a[setId]=rec; writeAll(TEST_KEY,a); }
  function clearSet(setId) { const s=readAll(STUDY_KEY); delete s[setId]; writeAll(STUDY_KEY,s); const t=readAll(TEST_KEY); delete t[setId]; writeAll(TEST_KEY,t); }

  function progress(set) {
    const r=getStudy(set.setId);
    return {
      s1:Object.values(r.stage1).filter(v=>v==='memorized').length,
      s2:Object.values(r.stage2).filter(v=>v && v.answered).length,
      s3:Object.values(r.stage3).filter(v=>v && v.answered).length
    };
  }

  function initSpeech() {
    if(!('speechSynthesis' in window)) return;
    const load=()=>{cachedVoices=window.speechSynthesis.getVoices()||[];};
    load(); window.speechSynthesis.addEventListener('voiceschanged',load);
  }
  function chooseVoice() {
    return cachedVoices.find(v=>v.lang==='en-US') || cachedVoices.find(v=>String(v.lang).toLowerCase().startsWith('en')) || cachedVoices.find(v=>String(v.name).toLowerCase().includes('english'));
  }
  function speakWord(text) {
    if(!('speechSynthesis' in window)) { alert('발음 재생이 안 되면 Chrome 브라우저에서 다시 열어 주세요.'); return; }
    try {
      window.speechSynthesis.cancel();
      const run=(retry=false)=>{
        const u=new SpeechSynthesisUtterance(text); u.lang='en-US'; u.rate=String(text).toLowerCase()==='bathe'?0.76:0.85;
        const voice=chooseVoice(); if(voice) u.voice=voice;
        u.onerror=()=>{ if(!retry) setTimeout(()=>run(true),120); else alert('발음 재생이 안 되면 Chrome 브라우저에서 다시 열어 주세요.'); };
        window.speechSynthesis.speak(u);
      };
      setTimeout(()=>run(false),80);
    } catch { alert('발음 재생이 안 되면 Chrome 브라우저에서 다시 열어 주세요.'); }
  }
  function haptic(pattern=10){ try{navigator.vibrate?.(pattern);}catch{} }
  function getAudio(){ try{ const C=window.AudioContext||window.webkitAudioContext; if(!C) return null; if(!audioCtx) audioCtx=new C(); if(audioCtx.state==='suspended') audioCtx.resume().catch(()=>{}); return audioCtx;}catch{return null;} }
  function tone(freq,start,duration){ const c=getAudio(); if(!c)return; const o=c.createOscillator(),g=c.createGain(); o.frequency.value=freq; g.gain.setValueAtTime(.0001,c.currentTime+start); g.gain.exponentialRampToValueAtTime(.08,c.currentTime+start+.01); g.gain.exponentialRampToValueAtTime(.0001,c.currentTime+start+duration); o.connect(g);g.connect(c.destination);o.start(c.currentTime+start);o.stop(c.currentTime+start+duration+.02); }
  function correctFx(){try{tone(660,0,.12);tone(880,.14,.16);haptic(35);}catch{}}
  function wrongFx(){try{tone(220,0,.2);haptic([45,35,45]);}catch{}}

  function topbar(title, homeTarget='home') {
    return `<header class="topbar">
      <button class="top-btn" data-action="go-${homeTarget}">⌂ <span>홈</span></button>
      <div class="top-title">${escapeHtml(title)}</div>
      <button class="top-btn" data-action="toggle-dark">${dark?'☀':'☾'} <span>모드</span></button>
      <button class="top-btn icon-only" data-action="copy-link">🔗</button>
    </header>`;
  }

  function definitionBlock(word, compact=false) {
    return `<div class="definition-wrap ${compact?'compact':''}">
      <div class="definition-en">${definitionHtml(word.definitionEn)}</div>
      <div class="definition-ko"><b>[해석]</b> ${escapeHtml(word.definitionKo)}</div>
    </div>`;
  }

  function speaker(word, small=true) { return `<button class="speak-btn ${small?'small':''}" data-speak="${escapeHtml(word.speakText||word.word)}" aria-label="발음 듣기">🔊</button>`; }

  function renderHome() {
    app.innerHTML=`<div class="home-screen">
      <div class="home-top-actions"><button data-action="toggle-dark">${dark?'☀ 라이트모드':'☾ 다크모드'}</button><button data-action="copy-link">🔗 링크 복사</button></div>
      <main class="home-card">
        <div class="home-badge">ELLA</div><h1>Vocabulary</h1><p>Yellow · Unit 1–10 · ${DATA.totalWords} words</p>
        <div class="home-options">
          <button class="home-option study" data-action="open-study"><span class="option-icon">📚</span><div><strong>단어 학습</strong><p>1단계 외우기 · 2단계 뜻 보고 고르기 · 3단계 알파벳 조립</p></div><span>›</span></button>
          <button class="home-option test" data-action="open-test"><span class="option-icon">✏️</span><div><strong>영영정의 단어시험</strong><p>영영정의를 읽고 4개의 보기에서 알맞은 단어 고르기</p></div><span>›</span></button>
        </div>
      </main>
    </div>`;
  }

  function drawerHtml() {
    const rows=DATA.sets.map(set=>{
      const p=progress(set);
      return `<button class="set-item ${currentSet.setId===set.setId?'active':''}" data-set="${set.setId}">
        <span class="set-name"><b>${escapeHtml(set.label)}</b><small>${escapeHtml(set.title)}</small></span>
        <span class="mini-progress">${[[1,p.s1],[2,p.s2],[3,p.s3]].map(([st,done])=>`<span class="mini-track"><span class="mini-fill" style="width:${done/set.wordCount*100}%"></span><span class="mini-text">${st}단계 (${done}/${set.wordCount})</span></span>`).join('')}</span>
      </button>`;
    }).join('');
    return `<div class="drawer-backdrop ${drawerOpen?'show':''}" data-action="close-drawer"></div><aside class="drawer ${drawerOpen?'open':''}"><div class="drawer-head"><div><strong>Unit / Lesson</strong><small>단어학습 진행률</small></div><button data-action="close-drawer">✕</button></div><div class="drawer-list">${rows}</div></aside>`;
  }

  function renderStudy() {
    const p=progress(currentSet);
    app.innerHTML=`<div class="app-shell">${topbar('ELLA 단어 학습')}${drawerHtml()}<main class="content study-content">
      <div class="lesson-header"><button class="menu-btn" data-action="open-drawer">☰ 메뉴</button><div><b>${escapeHtml(currentSet.label)}</b><span>${escapeHtml(currentSet.title)}</span></div></div>
      <div class="stage-tabs">${[1,2,3].map(s=>`<button class="${stage===s?'active':''}" data-stage="${s}">${s}단계</button>`).join('')}</div>
      <div class="stage-progress-row"><span>1단계 ${p.s1}/${currentSet.wordCount}</span><span>2단계 ${p.s2}/${currentSet.wordCount}</span><span>3단계 ${p.s3}/${currentSet.wordCount}</span></div>
      <div id="stage-slot"></div><button class="reset-link" data-action="reset-set">이 Lesson 기록 초기화</button>
    </main></div>`;
    renderStage();
  }

  function renderStage() {
    const slot=document.getElementById('stage-slot'); if(!slot)return;
    const set=currentSet, word=set.words[index], rec=getStudy(set.setId);
    if(stage===1){
      slot.innerHTML=`<section class="stage-panel"><div class="counter">${index+1} / ${set.words.length}</div>
      <button class="flip-card ${flipped?'flipped':''}" data-action="flip-card">${!flipped?`<div class="card-front"><div class="study-word-row"><span class="study-word">${escapeHtml(word.word)}</span>${speaker(word,false)}</div><small>카드를 눌러 뜻을 확인하세요</small></div>`:`<div class="card-back"><div class="back-word-row"><strong>${escapeHtml(word.word)}</strong>${speaker(word,true)}</div><div class="meaning stage1-meaning">${escapeHtml(word.meaningKo)}</div><div class="pos-pill">${escapeHtml(word.partOfSpeechKo)}</div>${definitionBlock(word)}</div>`}</button>
      <div class="action-grid two"><button data-move="-1" ${index===0?'disabled':''}>← 이전 카드</button><button data-move="1" ${index===set.words.length-1?'disabled':''}>다음 카드 →</button><button class="${rec.stage1[word.word]==='memorized'?'selected-good':''}" data-mark="memorized">✓ 외웠어요</button><button class="${rec.stage1[word.word]==='review'?'selected-warn':''}" data-mark="review">↻ 다시 볼래요</button></div></section>`;
    } else if(stage===2){
      if(!stage2Choices[word.word]){ const wrong=shuffle(set.words.filter(w=>w.word!==word.word))[0]; stage2Choices[word.word]=shuffle([word,wrong]); }
      const state=rec.stage2[word.word], answered=state?.answered;
      slot.innerHTML=`<section class="stage-panel"><div class="counter">${index+1} / ${set.words.length}</div><div class="prompt-card dashed"><div class="meaning">${escapeHtml(word.meaningKo)}</div>${definitionBlock(word,true)}</div>
      <div class="choices two-choice">${stage2Choices[word.word].map(c=>{const cor=answered&&c.word===word.word,wr=answered&&state.selected===c.word&&c.word!==word.word;return `<button class="choice ${cor?'correct':wr?'wrong':''}" data-choice2="${escapeHtml(c.word)}" ${answered?'disabled':''}><span>${escapeHtml(c.word)}</span>${speaker(c,true)}</button>`}).join('')}</div>
      ${answered?`<div class="result-msg ${state.correct?'good':'bad'}">${state.correct?'정답입니다!':`아쉬워요. 정답은 ${escapeHtml(word.word)}입니다.`}</div>`:''}
      <div class="action-grid two nav-only"><button data-prev ${index===0?'disabled':''}>← 이전 문제</button><button data-next2 ${index===set.words.length-1&&answered?'disabled':''}>다음 문제 →</button></div></section>`;
    } else {
      const target=normalizeAnswer(word.word);
      if(!stage3Banks[word.word]) stage3Banks[word.word]=shuffle(target.split('').map((ch,id)=>({id,ch})));
      const bank=stage3Banks[word.word], typed=stage3Selected.map(id=>bank.find(x=>x.id===id)?.ch||'').join(''), state=rec.stage3[word.word];
      slot.innerHTML=`<section class="stage-panel"><div class="counter">${index+1} / ${set.words.length}</div><div class="prompt-card dashed"><div class="meaning">${escapeHtml(word.meaningKo)}</div>${definitionBlock(word,true)}</div>
      <div class="assemble-answer">${target.split('').map((_,i)=>`<span>${escapeHtml(typed[i]||'_')}</span>`).join('')}</div><div class="letter-bank">${bank.map(b=>`<button data-letter="${b.id}" ${stage3Selected.includes(b.id)?'disabled':''}>${escapeHtml(b.ch)}</button>`).join('')}</div>
      ${state?.answered&&!state.correct?`<div class="result-msg bad">아쉬워요. 다시 조립해 보세요.</div>`:''}
      <div class="action-grid three nav-only"><button data-prev3 ${index===0?'disabled':''}>← 이전</button><button data-delete-letter>⌫ 지우기</button><button data-next3 ${index===set.words.length-1&&state?.answered?'disabled':''}>다음 →</button></div></section>`;
    }
  }

  function renderTestMenu(){
    app.innerHTML=`<div class="app-shell">${topbar('ELLA 영영정의 단어시험')}<main class="content test-menu"><div class="test-intro"><h2>영영정의를 보고 단어 맞히기</h2><p>각 Lesson 15문항 · 4지선다</p></div><div class="test-set-grid">${DATA.sets.map(set=>{const t=getTest(set.setId);return `<button class="test-set-card" data-test-set="${set.setId}"><span class="badge">${escapeHtml(set.label)}</span><strong>${escapeHtml(set.title)}</strong><small>최고점 ${t.best}/${set.wordCount} · 오답 ${t.wrong.length}</small></button>`}).join('')}</div></main></div>`;
  }

  function buildTest(set, onlyWords=null){
    const src=onlyWords||set.words;
    return shuffle(src).map(word=>({word,choices:shuffle([word,...shuffle(set.words.filter(w=>w.word!==word.word)).slice(0,3)])}));
  }
  function startTest(set,onlyWords=null){testSet=set;testQuestions=buildTest(set,onlyWords);testIndex=0;testSelected=null;testHint=false;testAnswers=[];screen='testQuiz';render();}

  function renderTestQuiz(){
    const q=testQuestions[testIndex], answered=testSelected!==null;
    app.innerHTML=`<div class="app-shell test-theme">${topbar('ELLA 영영정의 단어시험','testMenu')}<main class="content test-quiz"><div class="quiz-topline"><span>${escapeHtml(testSet.label)}</span><b>${testIndex+1} / ${testQuestions.length}</b></div><div class="quiz-progress"><span style="width:${(testIndex+1)/testQuestions.length*100}%"></span></div>
    <section class="definition-question"><small>DEFINITION</small><div>${definitionHtml(q.word.definitionEn)}</div></section>
    <div class="test-choices">${q.choices.map((c,i)=>{const cor=answered&&c.word===q.word.word,wr=answered&&testSelected===c.word&&c.word!==q.word.word;return `<button class="test-choice ${cor?'correct':wr?'wrong':''}" data-test-choice="${escapeHtml(c.word)}" ${answered?'disabled':''}><span class="choice-letter">${String.fromCharCode(65+i)}</span><span class="choice-main"><strong>${escapeHtml(c.word)}</strong><small>${escapeHtml(c.partOfSpeechKo)}</small></span>${speaker(c,true)}</button>`}).join('')}</div>
    ${!answered?`<button class="hint-btn" data-action="toggle-hint">💡 힌트 보기</button>${testHint?`<div class="hint-box">[힌트] 한글 뜻: ${escapeHtml(q.word.meaningKo)}</div>`:''}`:''}
    ${answered?`<div class="test-feedback ${testSelected===q.word.word?'good':'bad'}"><b>${testSelected===q.word.word?'정답입니다!':`정답은 ${escapeHtml(q.word.word)}입니다.`}</b><span>[해석] ${escapeHtml(q.word.definitionKo)}</span></div><button class="next-test-btn" data-action="next-test">${testIndex===testQuestions.length-1?'결과 보기':'다음 문제'}</button>`:''}
    </main></div>`;
  }

  function finishTest(){
    const score=testAnswers.filter(a=>a.correct).length, wrong=testAnswers.filter(a=>!a.correct).map(a=>a.word), old=getTest(testSet.setId);
    saveTest(testSet.setId,{best:Math.max(old.best,score),wrong:[...new Set(wrong)]}); screen='testResult';render();
  }
  function renderTestResult(){
    const score=testAnswers.filter(a=>a.correct).length, wrong=testAnswers.filter(a=>!a.correct).length;
    app.innerHTML=`<main class="result-screen"><div class="result-card"><span class="result-emoji">★</span><h2>${escapeHtml(testSet.label)} 결과</h2><div class="big-score">${score}<small> / ${testAnswers.length}</small></div><p>${wrong===0?'모든 문제를 맞혔어요.':`오답 ${wrong}개를 다시 확인해 보세요.`}</p><div class="result-actions"><button data-action="retry-test">다시 풀기</button><button data-action="wrong-list" ${wrong===0?'disabled':''}>오답 보기</button><button class="primary" data-action="go-testMenu">Lesson 선택</button></div></div></main>`;
  }
  function renderWrongList(){
    const wrong=testAnswers.filter(a=>!a.correct).map(a=>testSet.words.find(w=>w.word===a.word)).filter(Boolean);
    app.innerHTML=`<main class="wrong-screen"><div class="wrong-card"><h2>오답 단어</h2>${wrong.map(w=>`<div class="wrong-row"><div><strong>${escapeHtml(w.word)}</strong><span>${escapeHtml(w.meaningKo)}</span></div>${definitionBlock(w,true)}</div>`).join('')}<div class="result-actions"><button data-action="back-result">← 결과로</button><button class="primary" data-action="retry-wrong">오답만 다시 풀기</button></div></div></main>`;
  }

  function render(){
    document.body.classList.toggle('dark',dark);
    if(screen==='home')renderHome(); else if(screen==='study')renderStudy(); else if(screen==='testMenu')renderTestMenu(); else if(screen==='testQuiz')renderTestQuiz(); else if(screen==='testResult')renderTestResult(); else if(screen==='testWrong')renderWrongList();
  }

  function resetStudyNav(){ index=0; flipped=false; stage2Choices={}; stage3Banks={}; stage3Selected=[]; if(stage3Timer)clearTimeout(stage3Timer); }

  document.addEventListener('click',e=>{
    const el=e.target.closest('button'); if(!el)return;
    if(el.dataset.speak){ e.preventDefault();e.stopPropagation();haptic();speakWord(el.dataset.speak);return; }
    const action=el.dataset.action;
    if(action==='toggle-dark'){dark=!dark;writeAll(DARK_KEY,{value:dark});render();return;}
    if(action==='copy-link'){navigator.clipboard?.writeText(location.href);haptic();return;}
    if(action==='open-study'){screen='study';currentSet=DATA.sets[0];stage=1;resetStudyNav();render();return;}
    if(action==='open-test'){screen='testMenu';render();return;}
    if(action==='go-home'){screen='home';render();return;}
    if(action==='go-testMenu'){screen='testMenu';render();return;}
    if(action==='open-drawer'){drawerOpen=true;renderStudy();return;}
    if(action==='close-drawer'){drawerOpen=false;renderStudy();return;}
    if(action==='flip-card'){flipped=!flipped;renderStage();return;}
    if(action==='reset-set'){if(confirm('이 Lesson의 단어학습/시험 기록을 모두 초기화할까요?')){clearSet(currentSet.setId);resetStudyNav();renderStudy();}return;}
    if(action==='toggle-hint'){testHint=!testHint;renderTestQuiz();return;}
    if(action==='next-test'){if(testIndex===testQuestions.length-1){finishTest();}else{testIndex++;testSelected=null;testHint=false;renderTestQuiz();}return;}
    if(action==='retry-test'){startTest(testSet);return;}
    if(action==='wrong-list'){screen='testWrong';render();return;}
    if(action==='back-result'){screen='testResult';render();return;}
    if(action==='retry-wrong'){const wrong=testAnswers.filter(a=>!a.correct).map(a=>testSet.words.find(w=>w.word===a.word)).filter(Boolean);startTest(testSet,wrong);return;}

    if(el.dataset.set){currentSet=DATA.sets.find(s=>s.setId===el.dataset.set)||currentSet;drawerOpen=false;resetStudyNav();renderStudy();return;}
    if(el.dataset.stage){stage=Number(el.dataset.stage);resetStudyNav();renderStudy();return;}
    if(el.dataset.move){const d=Number(el.dataset.move);index=Math.max(0,Math.min(currentSet.words.length-1,index+d));flipped=false;renderStage();return;}
    if(el.dataset.mark){const word=currentSet.words[index],r=getStudy(currentSet.setId);r.stage1[word.word]=el.dataset.mark;saveStudy(currentSet.setId,r);haptic();renderStudy();return;}
    if('prev' in el.dataset){if(index>0){index--;renderStage();}return;}
    if('next2' in el.dataset){const word=currentSet.words[index],r=getStudy(currentSet.setId);if(!r.stage2[word.word]?.answered){r.stage2[word.word]={answered:true,correct:false};saveStudy(currentSet.setId,r);wrongFx();}if(index<currentSet.words.length-1)index++;renderStudy();return;}
    if(el.dataset.choice2){const word=currentSet.words[index],r=getStudy(currentSet.setId);if(r.stage2[word.word]?.answered)return;const correct=el.dataset.choice2===word.word;r.stage2[word.word]={answered:true,correct,selected:el.dataset.choice2};saveStudy(currentSet.setId,r);correct?correctFx():wrongFx();renderStudy();return;}
    if('prev3' in el.dataset){if(stage3Timer)clearTimeout(stage3Timer);if(index>0){index--;stage3Selected=[];renderStage();}return;}
    if('deleteLetter' in el.dataset){stage3Selected=stage3Selected.slice(0,-1);renderStage();return;}
    if('next3' in el.dataset){if(stage3Timer)clearTimeout(stage3Timer);const word=currentSet.words[index],r=getStudy(currentSet.setId);if(!r.stage3[word.word]?.answered){r.stage3[word.word]={answered:true,correct:false};saveStudy(currentSet.setId,r);wrongFx();}if(index<currentSet.words.length-1){index++;stage3Selected=[];}renderStudy();return;}
    if(el.dataset.letter!==undefined){const id=Number(el.dataset.letter);if(stage3Selected.includes(id))return;haptic();stage3Selected.push(id);const word=currentSet.words[index],target=normalizeAnswer(word.word),bank=stage3Banks[word.word],typed=stage3Selected.map(x=>bank.find(b=>b.id===x)?.ch||'').join('');if(stage3Selected.length===target.length){const r=getStudy(currentSet.setId);if(!r.stage3[word.word]?.answered){r.stage3[word.word]={answered:true,correct:typed===target};saveStudy(currentSet.setId,r);}if(typed===target){correctFx();renderStudy();stage3Timer=setTimeout(()=>{if(index<currentSet.words.length-1){index++;stage3Selected=[];renderStudy();}},750);}else{wrongFx();renderStudy();setTimeout(()=>{stage3Selected=[];renderStage();},350);}}else renderStage();return;}
    if(el.dataset.testSet){const set=DATA.sets.find(s=>s.setId===el.dataset.testSet);if(set)startTest(set);return;}
    if(el.dataset.testChoice){if(testSelected!==null)return;const q=testQuestions[testIndex],sel=el.dataset.testChoice,correct=sel===q.word.word;testSelected=sel;testAnswers.push({word:q.word.word,selected:sel,correct});correct?correctFx():wrongFx();renderTestQuiz();return;}
  });

  async function init(){
    try{
      const res=await fetch('data/vocabulary.json',{cache:'no-store'}); if(!res.ok)throw new Error(`HTTP ${res.status}`); DATA=await res.json();
      const d=readAll(DARK_KEY); dark=!!d.value; initSpeech(); currentSet=DATA.sets[0]; render();
    }catch(err){app.innerHTML=`<div class="fatal"><h2>데이터를 불러오지 못했습니다.</h2><p>${escapeHtml(err.message||err)}</p><p>로컬 파일 더블클릭 대신 웹서버/Vercel에서 실행해 주세요.</p></div>`;}
  }
  init();
})();

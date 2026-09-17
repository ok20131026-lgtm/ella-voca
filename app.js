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
  let reviewWords = null;
  let reviewResults = {};
  let stage3Feedback = '';
  let stage3Locked = false;
  let testReview = false;
  let speechTimer = null;
  let speechToken = 0;
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
  function clearSet(setId) { const s=readAll(STUDY_KEY); delete s[setId]; writeAll(STUDY_KEY,s); }

  function progress(set) {
    const r=getStudy(set.setId);
    return {
      s1:Object.values(r.stage1).filter(v=>v==='memorized').length,
      s2:Object.values(r.stage2).filter(v=>v && v.answered && v.correct).length,
      s3:Object.values(r.stage3).filter(v=>v && v.answered && v.correct).length
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
    if(!('speechSynthesis' in window)) { alert('이 브라우저에서는 발음을 지원하지 않습니다.'); return; }
    const token=++speechToken;
    clearTimeout(speechTimer);
    try {
      window.speechSynthesis.cancel();
      speechTimer=setTimeout(()=>{
        if(token!==speechToken)return;
        const u=new SpeechSynthesisUtterance(text); u.lang='en-US'; u.rate=.85;
        const voice=chooseVoice(); if(voice)u.voice=voice;
        u.onerror=e=>{if(token===speechToken&&!['canceled','interrupted'].includes(e.error))alert('발음 재생이 안 되면 브라우저에서 다시 열어 주세요.');};
        window.speechSynthesis.speak(u);
      },80);
    } catch { alert('발음을 재생할 수 없습니다.'); }
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
        <span class="mini-progress">${[[1,p.s1],[2,p.s2],[3,p.s3]].map(([st,done])=>`<span class="mini-track"><span class="mini-fill" style="width:${done/set.wordCount*100}%"></span><span class="mini-text"><span>${st}단계</span><b>${done}/${set.wordCount}</b></span></span>`).join('')}</span>
      </button>`;
    }).join('');
    return `<div class="drawer-backdrop ${drawerOpen?'show':''}" data-action="close-drawer"></div><aside class="drawer ${drawerOpen?'open':''}"><div class="drawer-head"><div><strong>Unit / Lesson</strong><small>암기·최초 정답 수</small></div><button data-action="close-drawer">✕</button></div><div class="drawer-list">${rows}</div></aside>`;
  }

  function renderStudy() {
    const p=progress(currentSet);
    app.innerHTML=`<div class="app-shell">${topbar('ELLA 단어 학습')}${drawerHtml()}<main class="content study-content">
      <div class="lesson-header"><button class="menu-btn" data-action="open-drawer">☰ 메뉴</button><div><b>${escapeHtml(currentSet.label)}</b><span>${escapeHtml(currentSet.title)}</span></div></div>
      <div class="stage-tabs">${[1,2,3].map(s=>`<button class="${stage===s?'active':''}" data-stage="${s}">${s}단계</button>`).join('')}</div>
      <div class="stage-progress-row"><span>1단계 ${p.s1}/${currentSet.wordCount}</span><span>2단계 ${p.s2}/${currentSet.wordCount}</span><span>3단계 ${p.s3}/${currentSet.wordCount}</span></div>
      <div id="stage-slot"></div><div class="review-controls"><button data-action="${reviewWords?'exit-review':'start-review'}">${reviewWords?'전체 학습으로':stage===1?'다시 볼 카드 복습':'이 단계 오답 복습'}${reviewWords?'':' ('+pendingWords().length+')'}</button><button class="reset-link" data-action="reset-set">이 Lesson 학습 기록 초기화</button></div>
    </main></div>`;
    renderStage();
  }


  function studyWords(){ return reviewWords || currentSet.words; }
  function pendingWords(){
    const r=getStudy(currentSet.setId)['stage'+stage];
    return currentSet.words.filter(w=>stage===1?r[w.word]==='review':r[w.word]?.answered&&!r[w.word].correct&&!r[w.word].reviewed);
  }
  function cancelStageTimer(){ if(stage3Timer!==null)clearTimeout(stage3Timer);stage3Timer=null;stage3Locked=false; }
  function moveStudy(delta){
    cancelStageTimer(); index=Math.max(0,Math.min(studyWords().length-1,index+delta));
    flipped=false;stage3Selected=[];stage3Feedback='';renderStudy();
  }
  function recordStudy(correct,selected){
    const word=studyWords()[index],r=getStudy(currentSet.setId),key='stage'+stage;
    if(reviewWords){
      reviewResults[word.word]={answered:true,correct,selected};
      if(r[key][word.word])r[key][word.word].reviewed=correct;
    } else if(!r[key][word.word]?.answered){
      r[key][word.word]={answered:true,correct,selected};
    }
    saveStudy(currentSet.setId,r);
  }
  function renderStage() {
    const slot=document.getElementById('stage-slot'); if(!slot)return;
    const words=studyWords(),word=words[index],rec=getStudy(currentSet.setId);
    if(!word){slot.innerHTML='<section class="stage-panel empty-state">복습할 단어가 없습니다.</section>';return;}
    const counter='<div class="counter">'+(reviewWords?'복습 · ':'')+(index+1)+' / '+words.length+'</div>';
    const state=reviewWords?reviewResults[word.word]:rec['stage'+stage][word.word];
    const answered=!!state?.answered,last=index===words.length-1;
    const progressCount=Object.values(rec['stage'+stage]).filter(v=>v?.answered).length;
    const summary=stage===1?'':`<div class="session-summary">풀이 ${progressCount}/${currentSet.wordCount} · 최초 정답 ${progress(currentSet)['s'+stage]}/${currentSet.wordCount}${reviewWords?' · 복습은 최초 점수를 바꾸지 않습니다.':''}</div>`;
    if(stage===1){
      slot.innerHTML=`<section class="stage-panel">${counter}
        <div class="flip-card ${flipped?'flipped':''}" data-action="flip-card" role="group" aria-label="단어 카드">
          <div class="${flipped?'card-back':'card-front'}">
            <div class="study-word-row"><button class="word-flip ${flipped?'back-word':'study-word'}" data-action="flip-card" aria-expanded="${flipped}">${escapeHtml(word.word)}</button>${speaker(word)}</div>
            ${flipped?`<div class="meaning stage1-meaning">${escapeHtml(word.meaningKo)}</div><div class="pos-pill">${escapeHtml(word.partOfSpeechKo)}</div>${definitionBlock(word)}`:'<small>카드를 눌러 뜻을 확인하세요</small>'}
          </div>
        </div>
        <div class="action-grid two"><button data-move="-1" ${index===0?'disabled':''}>← 이전 카드</button><button data-move="1" ${last?'disabled':''}>다음 카드 →</button><button class="${rec.stage1[word.word]==='memorized'?'selected-good':''}" data-mark="memorized">✓ 외웠어요</button><button class="${rec.stage1[word.word]==='review'?'selected-warn':''}" data-mark="review">↻ 다시 볼래요</button></div>
      </section>`;
    } else if(stage===2){
      if(!stage2Choices[word.word]){
        const old=rec.stage2[word.word];
        const savedWrong=!reviewWords&&currentSet.words.find(w=>w.word===old?.selected&&w.word!==word.word);
        const wrong=savedWrong||shuffle(currentSet.words.filter(w=>w.word!==word.word))[0];
        stage2Choices[word.word]=shuffle([word,wrong]);
      }
      slot.innerHTML=`<section class="stage-panel">${counter}${summary}
        <div class="prompt-card dashed"><div class="meaning">${escapeHtml(word.meaningKo)}</div>${definitionBlock(word,true)}</div>
        <div class="choices two-choice">${stage2Choices[word.word].map(c=>{
          const cor=answered&&c.word===word.word,wr=answered&&state.selected===c.word&&!cor;
          return `<div class="choice-row ${cor?'correct':wr?'wrong':''}"><button class="choice" data-choice2="${escapeHtml(c.word)}" ${answered?'disabled':''}>${escapeHtml(c.word)}</button>${speaker(c)}</div>`;
        }).join('')}</div>
        ${answered?`<div class="result-msg ${state.correct?'good':'bad'}" role="status">${state.correct?'정답입니다!':'아쉬워요. 정답은 '+escapeHtml(word.word)+'입니다.'}</div>`:''}
        <div class="action-grid two nav-only"><button data-prev ${index===0?'disabled':''}>← 이전 문제</button><button data-next2 ${last&&answered?'disabled':''}>다음 문제 →</button></div>
      </section>`;
    } else {
      const target=normalizeAnswer(word.word);
      if(!stage3Banks[word.word])stage3Banks[word.word]=shuffle(target.split('').map((ch,id)=>({id,ch})));
      const bank=stage3Banks[word.word],typed=stage3Selected.map(id=>bank.find(b=>b.id===id)?.ch||'').join('');
      let letterIndex=0;
      const slots=Array.from(word.word).map(ch=>/[a-z]/i.test(ch)?`<span>${escapeHtml(typed[letterIndex++]||'_')}</span>`:`<span class="fixed-character">${ch===' '?'&nbsp;':escapeHtml(ch)}</span>`).join('');
      slot.innerHTML=`<section class="stage-panel">${counter}${summary}
        <div class="prompt-card dashed"><div class="meaning">${escapeHtml(word.meaningKo)}</div>${definitionBlock(word,true)}</div>
        <div class="assemble-answer" aria-label="조립한 단어">${slots}</div>
        <div class="letter-bank">${bank.map(b=>`<button data-letter="${b.id}" ${stage3Locked||stage3Selected.includes(b.id)?'disabled':''}>${escapeHtml(b.ch)}</button>`).join('')}</div>
        ${stage3Feedback?`<div class="result-msg ${stage3Feedback==='정답입니다!'?'good':'bad'}" role="status">${stage3Feedback}</div>`:''}
        <div class="action-grid three nav-only"><button data-prev3 ${index===0?'disabled':''}>← 이전</button><button data-delete-letter ${stage3Locked||!stage3Selected.length?'disabled':''}>⌫ 지우기</button><button data-next3 ${last&&answered?'disabled':''}>다음 →</button></div>
      </section>`;
    }
  }


  function renderTestMenu(){
    app.innerHTML=`<div class="app-shell">${topbar('ELLA 영영정의 단어시험')}<main class="content test-menu"><div class="test-intro"><h2>영영정의를 보고 단어 맞히기</h2><p>각 Lesson 15문항 · 4지선다</p></div><div class="test-set-grid">${DATA.sets.map(set=>{const t=getTest(set.setId);return `<section class="test-set-card"><span class="badge">${escapeHtml(set.label)}</span><strong>${escapeHtml(set.title)}</strong><small>최고 정답 ${t.best}/${set.wordCount} · 오답 ${t.wrong.length}</small><div class="test-menu-actions"><button data-test-set="${set.setId}">시험 시작</button><button data-saved-wrong="${set.setId}" ${t.wrong.length?'':'disabled'}>오답 보기 (${t.wrong.length})</button></div></section>`}).join('')}</div></main></div>`;
  }
  function buildTest(set, onlyWords=null){
    const src=onlyWords||set.words;
    return shuffle(src).map(word=>({word,choices:shuffle([word,...shuffle(set.words.filter(w=>w.word!==word.word)).slice(0,3)])}));
  }
  function startTest(set,onlyWords=null){cancelStageTimer();if(onlyWords&&!onlyWords.length)return;testReview=!!onlyWords;testSet=set;testQuestions=buildTest(set,onlyWords);testIndex=0;testSelected=null;testHint=false;testAnswers=[];screen='testQuiz';render();}

  function renderTestQuiz(){
    const q=testQuestions[testIndex], answered=testSelected!==null;
    app.innerHTML=`<div class="app-shell test-theme">${topbar('ELLA 영영정의 단어시험','testMenu')}<main class="content test-quiz"><div class="quiz-topline"><span>${escapeHtml(testSet.label)}</span><b>${testIndex+1} / ${testQuestions.length}</b></div><div class="quiz-progress"><span style="width:${testAnswers.length/testQuestions.length*100}%"></span></div>
    <section class="definition-question"><small>DEFINITION</small><div>${definitionHtml(q.word.definitionEn)}</div></section>
    <div class="test-choices">${q.choices.map((c,i)=>{const cor=answered&&c.word===q.word.word,wr=answered&&testSelected===c.word&&c.word!==q.word.word;return `<div class="test-choice-row ${cor?'correct':wr?'wrong':''}"><button class="test-choice" data-test-choice="${escapeHtml(c.word)}" ${answered?'disabled':''}><span class="choice-letter">${String.fromCharCode(65+i)}</span><span class="choice-main"><strong>${escapeHtml(c.word)}</strong><small>${escapeHtml(c.partOfSpeechKo)}</small></span></button>${speaker(c,true)}</div>`}).join('')}</div>
    ${!answered?`<button class="hint-btn" data-action="toggle-hint">💡 힌트 보기</button>${testHint?`<div class="hint-box">[힌트] 알파벳 ${normalizeAnswer(q.word.word).length}개 · ${escapeHtml(q.word.partOfSpeechKo)}</div>`:''}`:''}
    ${answered?`<div class="test-feedback ${testSelected===q.word.word?'good':'bad'}"><b>${testSelected===q.word.word?'정답입니다!':`정답은 ${escapeHtml(q.word.word)}입니다.`}</b></div><button class="next-test-btn" data-action="next-test">${testIndex===testQuestions.length-1?'결과 보기':'다음 문제'}</button>`:''}
    </main></div>`;
  }

  function finishTest(){
    const score=testAnswers.filter(a=>a.correct).length, wrong=testAnswers.filter(a=>!a.correct).map(a=>a.word), old=getTest(testSet.setId);
    const attempted=new Set(testAnswers.map(a=>a.word)); saveTest(testSet.setId,{...old,best:testReview?old.best:Math.max(old.best,score),wrong:[...new Set([...(testReview?old.wrong.filter(w=>!attempted.has(w)):[]),...wrong])]}); screen='testResult';render();
  }
  function renderTestResult(){
    const score=testAnswers.filter(a=>a.correct).length, wrong=testAnswers.filter(a=>!a.correct).length;
    app.innerHTML=`<main class="result-screen"><div class="result-card"><span class="result-emoji">★</span><h2>${escapeHtml(testSet.label)} 결과</h2><div class="big-score">${score}<small> / ${testAnswers.length}</small></div><p>점수 ${Math.round(score/testAnswers.length*100)}점 · 오답 ${wrong}개${testReview?' · 복습 결과':''}</p><p>${wrong===0?'모든 문제를 맞혔어요.':`오답 ${wrong}개를 다시 확인해 보세요.`}</p><div class="result-actions"><button data-action="retry-test">다시 풀기</button><button data-action="wrong-list" ${wrong===0?'disabled':''}>오답 보기</button><button class="primary" data-action="go-testMenu">Lesson 선택</button></div></div></main>`;
  }
  function renderWrongList(){
    const wrong=testSet.words.filter(w=>getTest(testSet.setId).wrong.includes(w.word));
    app.innerHTML=`<main class="wrong-screen"><div class="wrong-card"><h2>${escapeHtml(testSet.label)} 오답 단어</h2>${wrong.length?'':'<p>오답 없음</p>'}${wrong.map(w=>`<details class="wrong-row"><summary><strong>${escapeHtml(w.word)}</strong><span>${escapeHtml(w.meaningKo)}</span></summary>${definitionBlock(w,true)}</details>`).join('')}<div class="result-actions"><button data-action="go-testMenu">← Lesson 선택</button><button class="primary" data-action="retry-wrong" ${wrong.length?'':'disabled'}>오답만 다시 풀기</button></div></div></main>`;
  }

  function render(){
    document.body.classList.toggle('dark',dark);
    if(screen==='home')renderHome(); else if(screen==='study')renderStudy(); else if(screen==='testMenu')renderTestMenu(); else if(screen==='testQuiz')renderTestQuiz(); else if(screen==='testResult')renderTestResult(); else if(screen==='testWrong')renderWrongList();
  }


  function resetStudyNav(){
    cancelStageTimer();index=0;flipped=false;stage2Choices={};stage3Banks={};stage3Selected=[];
    stage3Feedback='';reviewWords=null;reviewResults={};
  }

  document.addEventListener('click',e=>{
    const el=e.target.closest('button, [data-action]'); if(!el||el.disabled)return;
    if(el.dataset.speak){e.preventDefault();e.stopPropagation();haptic();speakWord(el.dataset.speak);return;}
    const action=el.dataset.action;
    if(action==='toggle-dark'){dark=!dark;writeAll(DARK_KEY,{value:dark});render();return;}
    if(action==='copy-link'){navigator.clipboard?.writeText(location.href)?.catch(()=>{});return;}
    if(['go-home','open-test','go-testMenu'].includes(action)){cancelStageTimer();drawerOpen=false;screen=action==='go-home'?'home':'testMenu';render();return;}
    if(action==='open-study'){screen='study';currentSet=DATA.sets[0];stage=1;drawerOpen=false;resetStudyNav();render();return;}
    if(action==='open-drawer'){cancelStageTimer();drawerOpen=true;renderStudy();return;}
    if(action==='close-drawer'){drawerOpen=false;renderStudy();return;}
    if(action==='flip-card'){flipped=!flipped;renderStage();return;}
    if(action==='reset-set'){
      if(confirm('이 Lesson의 단어학습 기록만 초기화할까요? 시험 기록은 유지됩니다.')){clearSet(currentSet.setId);resetStudyNav();renderStudy();}
      return;
    }
    if(action==='start-review'){
      const words=pendingWords();if(!words.length){alert(stage===1?'다시 볼 카드가 없습니다.':'오답 없음');return;}
      resetStudyNav();reviewWords=words;renderStudy();return;
    }
    if(action==='exit-review'){resetStudyNav();renderStudy();return;}
    if(action==='toggle-hint'){testHint=!testHint;renderTestQuiz();return;}
    if(action==='next-test'){
      if(testSelected===null)return;
      if(testIndex===testQuestions.length-1)finishTest();else{testIndex++;testSelected=null;testHint=false;renderTestQuiz();}
      return;
    }
    if(action==='retry-test'){startTest(testSet);return;}
    if(action==='wrong-list'){screen='testWrong';render();return;}
    if(action==='retry-wrong'){startTest(testSet,testSet.words.filter(w=>getTest(testSet.setId).wrong.includes(w.word)));return;}
    if(el.dataset.set){currentSet=DATA.sets.find(s=>s.setId===el.dataset.set)||currentSet;drawerOpen=false;resetStudyNav();renderStudy();return;}
    if(el.dataset.stage){stage=Number(el.dataset.stage);resetStudyNav();renderStudy();return;}
    if(el.dataset.move){moveStudy(Number(el.dataset.move));return;}
    if(el.dataset.mark){
      const word=studyWords()[index],r=getStudy(currentSet.setId);r.stage1[word.word]=el.dataset.mark;saveStudy(currentSet.setId,r);haptic();renderStudy();return;
    }
    if('prev' in el.dataset||'prev3' in el.dataset){moveStudy(-1);return;}
    if('next2' in el.dataset||'next3' in el.dataset){
      const word=studyWords()[index],state=reviewWords?reviewResults[word.word]:getStudy(currentSet.setId)['stage'+stage][word.word];
      if(!state?.answered){recordStudy(false,null);wrongFx();}
      moveStudy(1);return;
    }
    if(el.dataset.choice2){
      const word=studyWords()[index],state=reviewWords?reviewResults[word.word]:getStudy(currentSet.setId).stage2[word.word];
      if(state?.answered)return;
      const correct=el.dataset.choice2===word.word;
      recordStudy(correct,el.dataset.choice2);correct?correctFx():wrongFx();renderStudy();return;
    }
    if('deleteLetter' in el.dataset){if(stage3Locked)return;stage3Selected.pop();stage3Feedback='';renderStage();return;}
    if(el.dataset.letter!==undefined){
      if(stage3Locked)return;
      const id=Number(el.dataset.letter),word=studyWords()[index],bank=stage3Banks[word.word];
      if(stage3Selected.includes(id)||!bank.some(b=>b.id===id))return;
      stage3Selected.push(id);haptic();
      const target=normalizeAnswer(word.word),typed=stage3Selected.map(x=>bank.find(b=>b.id===x).ch).join('');
      if(stage3Selected.length===target.length){
        const correct=typed===target;recordStudy(correct,null);stage3Locked=true;
        stage3Feedback=correct?'정답입니다!':'아쉬워요. 다시 조립해 보세요.';
        correct?correctFx():wrongFx();renderStudy();
        const setId=currentSet.setId,at=index,review=reviewWords;
        stage3Timer=setTimeout(()=>{
          stage3Timer=null;stage3Locked=false;
          if(screen!=='study'||stage!==3||currentSet.setId!==setId||index!==at||reviewWords!==review)return;
          if(correct&&index<studyWords().length-1){moveStudy(1);}
          else{if(!correct)stage3Selected=[];renderStudy();}
        },correct?750:350);
      }else{stage3Feedback='';renderStage();}
      return;
    }
    if(el.dataset.testSet){const set=DATA.sets.find(s=>s.setId===el.dataset.testSet);if(set)startTest(set);return;}
    if(el.dataset.savedWrong){testSet=DATA.sets.find(s=>s.setId===el.dataset.savedWrong);if(testSet){screen='testWrong';render();}return;}
    if(el.dataset.testChoice){
      if(testSelected!==null)return;
      const q=testQuestions[testIndex],sel=el.dataset.testChoice;
      if(!q.choices.some(c=>c.word===sel))return;
      const correct=sel===q.word.word;testSelected=sel;testAnswers.push({word:q.word.word,selected:sel,correct});
      const old=getTest(testSet.setId),wrong=new Set(old.wrong);
      if(correct)wrong.delete(q.word.word);else wrong.add(q.word.word);
      saveTest(testSet.setId,{...old,wrong:[...wrong]});
      correct?correctFx():wrongFx();renderTestQuiz();return;
    }
  });

  async function init(){
    try{
      const res=await fetch('data/vocabulary.json',{cache:'no-store'}); if(!res.ok)throw new Error(`HTTP ${res.status}`); DATA=await res.json();
      const d=readAll(DARK_KEY); dark=!!d.value; initSpeech(); currentSet=DATA.sets[0]; render();
    }catch(err){app.innerHTML=`<div class="fatal"><h2>데이터를 불러오지 못했습니다.</h2><p>${escapeHtml(err.message||err)}</p><p>로컬 파일 더블클릭 대신 웹서버/Vercel에서 실행해 주세요.</p></div>`;}
  }
  init();
})();

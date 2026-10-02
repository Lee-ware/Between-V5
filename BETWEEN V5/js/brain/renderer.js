// ===================== BRAIN RENDERER =====================
// UI-only layer. It never decides what a correct answer is; generators supply
// the answer and BrainRun records telemetry.

const BrainRenderer = (() => {
  const LETTERS = ['A','B','C','D','E','F'];

  function esc(v){ return Utils.escapeHtml(v == null ? '' : String(v)); }
  function tileGrid(size, values, opts={}) {
    const clickable = opts.clickable !== false;
    const cls = opts.className || 'brain-tile';
    return `<div class="brain-grid" style="grid-template-columns:repeat(${size},1fr);">${values.map((v,i)=>
      clickable ? `<button class="${cls}" data-i="${i}">${v == null || v === '' ? '&nbsp;' : esc(v)}</button>` : `<div class="${cls}" data-i="${i}" style="display:flex;align-items:center;justify-content:center;">${v == null || v === '' ? '&nbsp;' : esc(v)}</div>`
    ).join('')}</div>`;
  }
  function status(text){ return `<div class="brain-status">${esc(text)}</div>`; }
  function choiceButtons(values, attr='v') {
    return `<div class="options-stack">${values.map((v,i)=>`<button class="option-card" data-${attr}="${esc(v)}" style="text-align:center;">${LETTERS[i]||''}${LETTERS[i]?' · ':''}${esc(v)}</button>`).join('')}</div>`;
  }
  function miniGridHTML(size, values) {
    return `<div class="brain-mini-grid" style="display:grid;grid-template-columns:repeat(${size},1fr);gap:4px;width:100%;">${values.map(v=>`<span style="aspect-ratio:1;display:flex;align-items:center;justify-content:center;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);font-weight:900;font-size:${size===3?'14':'17'}px;">${esc(v)}</span>`).join('')}</div>`;
  }

  function play(container, run, ctx, onFinish) {
    let observer = null;
    let stageGuard = 0;
    let disposed = false;

    function dispose(){
      if(disposed) return; disposed=true;
      if(observer) observer.disconnect();
      run.cancel();
    }

    if(typeof MutationObserver !== 'undefined' && document.documentElement){
      observer = new MutationObserver(()=>{ if(!container.isConnected) dispose(); });
      observer.observe(document.documentElement,{childList:true,subtree:true});
    }

    function frame(challenge){
      const n=run.stageIndex+1, total=run.stages.length;
      const prefix=run.item.brain_type==='final_boss'?'FINAL BOSS · ':'Brain · ';
      return `<div class="brain-status" style="margin-top:4px;">${esc(prefix)}Stage ${n}/${total}</div>`;
    }

    function complete(expectedGuard, correct, errors=0, score=null){
      if(disposed || expectedGuard !== stageGuard || !run.active) return;
      const finished=run.completeStage({correct,errors,score});
      if(finished){
        const summary=run.summary();
        if(observer) observer.disconnect();
        onFinish(summary);
        return;
      }
      const guard=++stageGuard;
      container.querySelectorAll('button').forEach(b=>b.disabled=true);
      const next=run.currentStage;
      container.querySelector('#stage-result').innerHTML=`<div class="reveal-card pulse"><div class="reveal-answer" style="font-size:19px;">${correct?'Nice.':'Not quite.'}</div></div>`;
      run.schedule(()=>{ if(guard===stageGuard) renderStage(); }, 420);
    }

    function renderStage(){
      if(disposed || !run.active) return;
      const challenge=run.currentStage;
      if(!challenge) return;
      run.startStage(challenge);
      const localToken=++stageGuard;
      const finish=(correct,errors=0,score=null)=>complete(localToken,correct,errors,score);
      const stageRun=Object.create(run);
      stageRun.schedule=(fn,ms)=>run.schedule(()=>{ if(localToken===stageGuard) fn(); },ms);
      container.innerHTML=`${frame(challenge)}<div id="stage-slot"></div><div id="stage-result"></div>`;
      const slot=container.querySelector('#stage-slot');
      switch(challenge.type){
        case 'visual_search': renderVisualSearch(slot,challenge,finish); break;
        case 'memory_grid': renderMemoryGrid(slot,challenge,finish,stageRun,localToken); break;
        case 'sequence': renderSequence(slot,challenge,finish,stageRun,localToken,false); break;
        case 'reverse': renderSequence(slot,challenge,finish,stageRun,localToken,true); break;
        case 'rule_switch': renderRuleSwitch(slot,challenge,finish,stageRun,localToken); break;
        case 'go_no_go': renderGoNoGo(slot,challenge,finish,stageRun,localToken); break;
        case 'odd_one': renderOddOne(slot,challenge,finish,localToken); break;
        case 'change_detection': renderChange(slot,challenge,finish,stageRun,localToken); break;
        case 'flash_recall': renderFlashRecall(slot,challenge,finish,stageRun,localToken); break;
        case 'spatial': renderSpatial(slot,challenge,finish,stageRun,localToken); break;
        case 'path': renderPath(slot,challenge,finish,stageRun,localToken); break;
        case 'classification': renderClassification(slot,challenge,finish,stageRun,localToken); break;
        case 'number_trap': renderNumberTrap(slot,challenge,finish,localToken); break;
        case 'symbol_mapping': renderSymbolMapping(slot,challenge,finish,stageRun,localToken); break;
        case 'mirror': renderMirror(slot,challenge,finish,localToken); break;
        case 'pattern': renderPattern(slot,challenge,finish,localToken); break;
        case 'rapid_sort': renderClassification(slot,challenge,finish,stageRun,localToken,true); break;
        case 'memory_distraction': renderMemoryDistraction(slot,challenge,finish,stageRun,localToken); break;
        case 'one_second': renderOneSecond(slot,challenge,finish,stageRun,localToken); break;
        default: finish(false,1); break;
      }
      if(Number.isFinite(challenge.timeLimit)) {
        stageRun.schedule(()=>finish(false,1), challenge.timeLimit);
      }
    }

    function showTimedTransition(){
      container.innerHTML=`
        <div class="brain-status" style="margin-top:18px;color:var(--c-brain);">BRAIN</div>
        <div class="reveal-card pulse">
          <div class="reveal-answer" style="font-size:28px;">Now the clock matters.</div>
          <div class="reveal-sub">You’ve had your warm-up. From this run on, the challenges have real time limits.</div>
          <button class="primary-btn" id="brain-start-timed" style="margin-top:18px;">Start</button>
        </div>`;
      container.querySelector('#brain-start-timed')?.addEventListener('click',()=>{ if(!disposed && run.active) renderStage(); });
    }

    if (typeof run.isTimedStart === 'function' && run.isTimedStart()) showTimedTransition();
    else renderStage();
    return { cancel:dispose };
  }

  function renderVisualSearch(slot,c,done,runToken){
    slot.innerHTML=status(c.instructions)+tileGrid(c.gridSize,c.values);
    const started=performance.now(); let finished=false;
    slot.querySelectorAll('.brain-tile').forEach(b=>b.addEventListener('click',()=>{
      if(finished) return; finished=true; const ok=Number(b.dataset.i)===c.answerIndex;
      b.classList.add(ok?'correct':'incorrect'); slot.querySelectorAll('.brain-tile').forEach(x=>x.disabled=true);
      done(ok,ok?0:1);
    }));
  }

  function renderMemoryGrid(slot,c,done,run,token){
    slot.innerHTML=status(c.instructions)+tileGrid(c.gridSize,Array(c.gridSize*c.gridSize).fill(''));
    const tiles=[...slot.querySelectorAll('.brain-tile')]; let armed=false,finished=false,picked=new Set();
    let presentationTimer=null;
    const presentationStartedAt=performance.now();
    const displayMs=Math.max(0,Number(c.displayTime)||0);
    const arm=()=>{
      if(armed||finished) return;
      if(!slot.isConnected||!run.active||token!==run.stageIndex+1){
        if(presentationTimer!==null){clearTimeout(presentationTimer);presentationTimer=null;}
        return;
      }
      tiles.forEach(t=>{t.classList.remove('lit');t.disabled=false;});
      armed=true;
      const statusEl=slot.querySelector('.brain-status');
      if(statusEl) statusEl.textContent='Rebuild the highlighted cells.';
      if(presentationTimer!==null){clearTimeout(presentationTimer);presentationTimer=null;}
    };
    const recoverPresentation=()=>{
      if(!armed && performance.now()-presentationStartedAt>=displayMs) arm();
    };
    c.targets.forEach(i=>tiles[i].classList.add('lit'));

    // Primary Brain timer. A lifecycle recovery check covers the browser/PWA
    // case where a page is backgrounded/frozen and a scheduled callback is not
    // delivered cleanly on resume. It never changes the intended display time.
    run.schedule(arm,displayMs);
    presentationTimer=setTimeout(arm,displayMs+50);
    document.addEventListener('visibilitychange',recoverPresentation);
    window.addEventListener('pageshow',recoverPresentation);
    window.addEventListener('resume',recoverPresentation);

    const cleanupPresentation=()=>{
      if(presentationTimer!==null){clearTimeout(presentationTimer);presentationTimer=null;}
      document.removeEventListener('visibilitychange',recoverPresentation);
      window.removeEventListener('pageshow',recoverPresentation);
      window.removeEventListener('resume',recoverPresentation);
    };

    tiles.forEach(t=>t.addEventListener('click',()=>{
      if(!armed||finished||picked.has(Number(t.dataset.i))) return;
      const i=Number(t.dataset.i); picked.add(i); t.classList.add('lit'); t.disabled=true;
      if(!c.targets.includes(i)){finished=true;cleanupPresentation();done(false,1);return;}
      if(picked.size===c.targets.length){finished=true;cleanupPresentation();done(true,0);}
    }));
  }

  function renderSequence(slot,c,done,run,token,reverse){
    slot.innerHTML=status('Watch closely…')+`<div class="brain-seq" style="display:flex;justify-content:center;gap:12px;flex-wrap:wrap;margin-top:18px;">${c.tokens.map((x,i)=>`<span data-i="${i}" style="font-size:28px;font-weight:900;opacity:.22;">${esc(x)}</span>`).join('')}</div><div id="seq-choices"></div>`;
    const spans=[...slot.querySelectorAll('.brain-seq span')]; let i=0, finished=false;
    const spanLength=c.tokens.length;
    const renderChoices=()=>{
      if(finished||!slot.isConnected) return;
      const area=slot.querySelector('#seq-choices'); area.innerHTML=status(reverse?'Tap it backwards.':'Tap it in the same order.')+choiceButtons(c.tokens,'v');
      let pos=reverse?c.tokens.length-1:0;
      area.querySelectorAll('.option-card').forEach(btn=>btn.addEventListener('click',()=>{
        if(finished) return;
        const expected=c.tokens[pos]; const ok=btn.dataset.v===expected;
        if(!ok){finished=true;btn.classList.add('incorrect');done(false,1);return;}
        btn.classList.add('correct');btn.disabled=true;pos += reverse?-1:1;
        if((reverse&&pos<0)||(!reverse&&pos>=c.tokens.length)){finished=true;done(true,0);}
      }));
    };
    // Avoid accidental duplicate timer condition; this is intentionally one step per token.
    const pulse=()=>{
      if(finished||!slot.isConnected) return;
      spans.forEach(s=>s.style.opacity='.22');
      if(i<spanLength){spans[i].style.opacity='1';i++;run.schedule(pulse,c.flashTime);}
      else run.schedule(renderChoices,180);
    };
    run.schedule(pulse,220);
  }

  function renderRuleSwitch(slot,c,done,run,token){
    let round=0,finished=false;
    const draw=()=>{
      if(finished||!slot.isConnected) return;
      const r=c.rounds[round];
      slot.innerHTML=status(r.rule.text)+`<div class="options-stack">${r.cards.map((x,i)=>`<button class="option-card" data-i="${i}" style="text-align:center;font-size:22px;"><b>${esc(x.symbol)}</b><span style="display:block;font-size:12px;color:var(--text-dim);margin-top:4px;">${x.number}</span></button>`).join('')}</div>`;
      slot.querySelectorAll('.option-card').forEach(btn=>btn.addEventListener('click',()=>{
        const ok=Number(btn.dataset.i)===r.answerIndex;
        if(!ok){finished=true;btn.classList.add('incorrect');done(false,1);return;}
        btn.classList.add('correct');btn.disabled=true;round++;
        if(round>=c.rounds.length){finished=true;done(true,0);return;}
        run.schedule(draw,220);
      }));
    };
    draw();
  }

  function renderGoNoGo(slot,c,done,run,token){
    let index=0,finished=false,cycleToken=0;
    slot.innerHTML=status(c.instructions)+'<div id="gn-zone"></div>';
    const zone=slot.querySelector('#gn-zone');
    const next=()=>{
      if(finished||!slot.isConnected) return;
      if(index>=c.sequence.length){finished=true;done(true,0);return;}
      const mine=++cycleToken; const symbol=c.sequence[index]; const isGo=symbol===c.go;
      zone.innerHTML=`<button class="big-option" id="gn-btn" style="justify-content:center;font-size:34px;">${esc(symbol)}</button><div class="brain-status">${index+1}/${c.sequence.length}</div>`;
      const btn=zone.querySelector('#gn-btn');
      btn.addEventListener('click',()=>{
        if(finished||mine!==cycleToken) return;
        if(!isGo){finished=true;btn.classList.add('incorrect');done(false,1);return;}
        btn.classList.add('correct');btn.disabled=true;index++;run.schedule(next,90);
      });
      run.schedule(()=>{
        if(finished||mine!==cycleToken) return;
        if(isGo){finished=true;done(false,1);} else {index++;next();}
      },c.itemMs);
    };
    next();
  }

  function renderOddOne(slot,c,done,token){
    slot.innerHTML=status(c.instructions)+tileGrid(c.gridSize,c.values); let finished=false;
    slot.querySelectorAll('.brain-tile').forEach(b=>b.addEventListener('click',()=>{
      if(finished)return; finished=true; const ok=Number(b.dataset.i)===c.oddIndex; b.classList.add(ok?'correct':'incorrect');done(ok,ok?0:1);
    }));
  }

  function renderChange(slot,c,done,run,token){
    let finished=false;
    slot.innerHTML=status('Remember this grid.')+tileGrid(c.gridSize,c.first,{clickable:false});
    run.schedule(()=>{
      if(finished||!slot.isConnected)return;
      slot.innerHTML=status(c.instructions)+tileGrid(c.gridSize,c.second);
      slot.querySelectorAll('.brain-tile').forEach(b=>b.addEventListener('click',()=>{
        if(finished)return;finished=true;const ok=Number(b.dataset.i)===c.changedIndex;b.classList.add(ok?'correct':'incorrect');done(ok,ok?0:1);
      }));
    },c.revealTime);
  }

  function renderFlashRecall(slot,c,done,run,token){
    let finished=false;
    slot.innerHTML=status('One quick look.')+`<div class="brain-seq" style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:18px;">${c.tokens.map(x=>`<span style="font-size:23px;font-weight:900;">${esc(x)}</span>`).join('')}</div>`;
    run.schedule(()=>{
      if(finished||!slot.isConnected)return;
      slot.innerHTML=status(c.question)+choiceButtons(c.choices,'v');
      slot.querySelectorAll('.option-card').forEach(b=>b.addEventListener('click',()=>{if(finished)return;finished=true;const ok=b.dataset.v===c.answer;b.classList.add(ok?'correct':'incorrect');done(ok,ok?0:1);}));
    },c.displayTime);
  }

  function renderSpatial(slot,c,done,run,token){
    const values=Array(c.gridSize*c.gridSize).fill(''); c.objects.forEach(o=>values[o.index]=o.symbol);
    let finished=false;
    slot.innerHTML=status(c.instructions)+tileGrid(c.gridSize,values,{clickable:false});
    run.schedule(()=>{
      if(finished||!slot.isConnected)return;
      slot.innerHTML=status(`Where was ${c.targetSymbol}?`)+tileGrid(c.gridSize,Array(c.gridSize*c.gridSize).fill(''));
      slot.querySelectorAll('.brain-tile').forEach(b=>b.addEventListener('click',()=>{if(finished)return;finished=true;const ok=Number(b.dataset.i)===c.targetIndex;b.classList.add(ok?'correct':'incorrect');done(ok,ok?0:1);}));
    },c.displayTime);
  }

  function renderPath(slot,c,done,run,token){
    let finished=false;
    const blank=Array(c.gridSize*c.gridSize).fill('');
    const values=blank.slice(); c.path.forEach(i=>values[i]='•');
    slot.innerHTML=status(c.instructions)+tileGrid(c.gridSize,values,{clickable:false});
    run.schedule(()=>{
      if(finished||!slot.isConnected)return;
      slot.innerHTML=status('Recreate the path in order.')+tileGrid(c.gridSize,blank); let pos=0;
      slot.querySelectorAll('.brain-tile').forEach(b=>b.addEventListener('click',()=>{if(finished)return;const i=Number(b.dataset.i);if(i!==c.path[pos]){finished=true;b.classList.add('incorrect');done(false,1);return;}b.classList.add('lit');b.disabled=true;pos++;if(pos>=c.path.length){finished=true;done(true,0);}}));
    },c.displayTime);
  }

  function renderClassification(slot,c,done,run,token,rapid=false){
    let index=0,finished=false,cycle=0;
    const draw=()=>{
      if(finished||!slot.isConnected)return;
      if(index>=c.items.length){finished=true;done(true,0);return;}
      const mine=++cycle, item=c.items[index];
      slot.innerHTML=status(`${c.instructions} · ${index+1}/${c.items.length}`)+`<div style="margin-top:24px;text-align:center;font-size:${rapid?'28':'30'}px;font-weight:900;letter-spacing:.02em;">${esc(item.text)}</div><div class="two-up" style="margin-top:24px;"><button class="big-option" data-side="0" style="justify-content:center;min-height:90px;">LEFT</button><button class="big-option" data-side="1" style="justify-content:center;min-height:90px;">RIGHT</button></div>`;
      slot.querySelectorAll('.big-option').forEach(b=>b.addEventListener('click',()=>{if(finished||mine!==cycle)return;const ok=Number(b.dataset.side)===item.side;if(!ok){finished=true;b.classList.add('incorrect');done(false,1);return;}b.classList.add('correct');b.disabled=true;cycle++;index++;run.schedule(draw,80);}));
      run.schedule(()=>{if(finished||mine!==cycle)return;finished=true;done(false,1);},c.perItemLimit);
    };
    draw();
  }

  function renderNumberTrap(slot,c,done,token){
    let finished=false;
    slot.innerHTML=status(c.instructions)+choiceButtons(c.numbers,'v');
    slot.querySelectorAll('.option-card').forEach(b=>b.addEventListener('click',()=>{if(finished)return;finished=true;const ok=Number(b.dataset.v)===c.numbers[c.answerIndex];b.classList.add(ok?'correct':'incorrect');done(ok,ok?0:1);}));
  }

  function renderSymbolMapping(slot,c,done,run,token){
    let part=0,finished=false;
    const draw=()=>{
      if(finished||!slot.isConnected)return;
      const p=c.parts[part]; const map=`<div style="display:flex;justify-content:center;gap:10px;flex-wrap:wrap;margin-top:16px;">${c.symbols.map(s=>`<div style="padding:10px 12px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);font-weight:900;">${esc(s)} = ${p.mapping[s]}</div>`).join('')}</div>`;
      const sequence=p.sequence.map(esc).join('  ');
      const choices=[p.answer,p.answer-1,p.answer+1,p.answer+2].filter((x,i,a)=>a.indexOf(x)===i).slice(0,4);
      slot.innerHTML=status(`${p.label} · What is the total?`)+map+`<div class="brain-status" style="font-size:25px;color:var(--text);margin-top:22px;">${sequence}</div>`+choiceButtons(choices,'v');
      slot.querySelectorAll('.option-card').forEach(b=>b.addEventListener('click',()=>{if(finished)return;const ok=Number(b.dataset.v)===p.answer;if(!ok){finished=true;b.classList.add('incorrect');done(false,1);return;}b.classList.add('correct');b.disabled=true;part++;if(part>=c.parts.length){finished=true;done(true,0);return;}run.schedule(draw,280);}));
    };
    draw();
  }

  function renderMirror(slot,c,done,token){
    let finished=false;
    slot.innerHTML=status(c.instructions)+`<div style="margin-top:18px;max-width:180px;margin-left:auto;margin-right:auto;">${miniGridHTML(c.gridSize,c.base)}</div><div class="brain-status">Choose the mirror.</div><div class="options-stack">${c.choices.map((v,i)=>`<button class="option-card" data-i="${i}" style="padding:12px;background:var(--surface);">${miniGridHTML(c.gridSize,v)}</button>`).join('')}</div>`;
    slot.querySelectorAll('.option-card').forEach(b=>b.addEventListener('click',()=>{if(finished)return;finished=true;const ok=Number(b.dataset.i)===c.correctIndex;b.classList.add(ok?'correct':'incorrect');done(ok,ok?0:1);}));
  }

  function renderPattern(slot,c,done,token){
    let finished=false;
    slot.innerHTML=status(c.instructions)+`<div style="margin-top:20px;text-align:center;font-size:23px;font-weight:900;letter-spacing:.05em;">${c.sequence.map(esc).join(' → ')} → ?</div>`+choiceButtons(c.choices,'v');
    slot.querySelectorAll('.option-card').forEach(b=>b.addEventListener('click',()=>{if(finished)return;finished=true;const ok=Number(b.dataset.v)===c.answer;b.classList.add(ok?'correct':'incorrect');done(ok,ok?0:1);}));
  }

  function renderMemoryDistraction(slot,c,done,run,token){
    let finished=false;
    slot.innerHTML=status('Remember this. A distraction is coming.')+`<div class="brain-seq" style="display:flex;justify-content:center;gap:10px;margin-top:18px;">${c.tokens.map(x=>`<span style="font-size:23px;font-weight:900;">${esc(x)}</span>`).join('')}</div>`;
    run.schedule(()=>{
      if(finished||!slot.isConnected)return;
      slot.innerHTML=`<div class="reveal-card pulse"><div class="reveal-answer" style="font-size:21px;">DISTRACTION</div><div class="reveal-sub">Take a breath. Now use what you remembered.</div></div>`;
      run.schedule(()=>{
        if(finished||!slot.isConnected)return;
        slot.innerHTML=status(c.question)+choiceButtons(c.choices,'v');
        slot.querySelectorAll('.option-card').forEach(b=>b.addEventListener('click',()=>{if(finished)return;finished=true;const ok=b.dataset.v===c.answer;b.classList.add(ok?'correct':'incorrect');done(ok,ok?0:1);}));
      },650);
    },c.displayTime);
  }

  function renderOneSecond(slot,c,done,run,token){
    let finished=false;
    slot.innerHTML=status(c.instructions)+`<div style="font-size:42px;letter-spacing:10px;text-align:center;margin-top:28px;font-weight:900;">${c.values.map(esc).join(' ')}</div>`;
    run.schedule(()=>{
      if(finished||!slot.isConnected)return;
      const choices=[c.answer,Math.max(0,c.answer-1),c.answer+1,c.answer+2].filter((x,i,a)=>a.indexOf(x)===i).slice(0,4);
      slot.innerHTML=status(c.instructions)+choiceButtons(choices,'v');
      slot.querySelectorAll('.option-card').forEach(b=>b.addEventListener('click',()=>{if(finished)return;finished=true;const ok=Number(b.dataset.v)===c.answer;b.classList.add(ok?'correct':'incorrect');done(ok,ok?0:1);}));
    },c.displayTime);
  }

  return { play };
})();

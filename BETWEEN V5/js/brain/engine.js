// ===================== BRAIN ENGINE =====================
// Coordinates the 20 player-facing Brain experiences with procedural engines.
// This is deliberately separate from the normal content engine.

const BrainEngine = (() => {
  let activeRunHandle = null;
  function clamp(v,a,b){ return Math.max(a,Math.min(b,v)); }
  function brainNextButtonHTML(label='Next'){
    return `<div class="next-cta"><button class="btn btn-primary" id="btn-next" data-icon-right="next">${Utils.escapeHtml(label)} →</button></div>`;
  }
  function bindBrainNext(container,ctx){
    const btn=container.querySelector('#btn-next');
    if(btn) btn.addEventListener('click',()=>ctx.next());
  }
  function seedFor(item, daily){
    if(daily) return Utils.hashString(`${Utils.todayKey()}:between:brain`);
    return Utils.hashString(`${item.id}:${Date.now()}:${Math.random()}`);
  }
  function buildPlan(item, rnd){
    if(item.brain_type==='final_boss') return ['memory_grid','rule_switch','sequence','change_detection','symbol_mapping','rule_switch','memory_distraction','final_change'];
    const anchor=item.brain_type;
    const pool=BrainConfig.engineTypes.filter(t=>t!==anchor);
    const picked=[];
    while(picked.length<5 && pool.length){
      const i=Math.floor(rnd()*pool.length); picked.push(pool.splice(i,1)[0]);
    }
    return [anchor,...picked];
  }
  function start(container,item,ctx,{daily=false}={}){
    const seed=seedFor(item,daily); const rnd=Utils.seededRandom(seed);
    const plan=buildPlan(item,rnd);
    const history = (!daily && typeof Storage !== 'undefined' && typeof Storage.getBrainRuns === 'function') ? Storage.getBrainRuns() : [];
    const completedNormalRuns = history.filter(r => r && r.daily !== true).length;
    const runNumber = daily ? 1 : completedNormalRuns + 1;
    const run=BrainRun.create({item,seed,daily,runNumber});
    run.setPlan(plan, (type, level, generatorRnd) => BrainGenerators.generate(type, level, generatorRnd), rnd);

    const brainRun=BrainRenderer.play(container,run,ctx,(summary)=>{
      if(typeof App.handleBrainRun === 'function') App.handleBrainRun(summary);
      const accepted=ctx.reportResult({success:null,label:'Brain run complete',scoreValue:summary.score,brainRun:summary});
      const dims=summary.dimensions;
      container.innerHTML=`
        <div class="brain-status" style="color:var(--c-brain);">BRAIN RUN COMPLETE</div>
        <div class="reveal-card pulse">
          <div class="reveal-sub">${Utils.escapeHtml(item.title || 'Brain')}</div>
          <div class="reveal-answer" style="font-size:32px;">${summary.score}/100</div>
          <div class="reveal-sub">Strongest: <b style="color:var(--text);">${Utils.escapeHtml(summary.strongest)}</b></div>
          <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin-top:18px;">
            ${Object.entries(dims).map(([k,v])=>`<div class="stat-box"><div class="stat-num">${v}%</div><div class="stat-label">${escLabel(k)}</div></div>`).join('')}
          </div>
          <div class="reveal-sub" style="margin-top:14px;">Game stats only. Not an intelligence or psychological assessment.</div>
        </div>
        ${brainNextButtonHTML()}`;
      if(accepted!==false) bindBrainNext(container,ctx);
      activeRunHandle = null;
    });
    activeRunHandle = brainRun;
    return brainRun;
  }
  function cancel(){ if(activeRunHandle && typeof activeRunHandle.cancel==='function') activeRunHandle.cancel(); activeRunHandle=null; }
  function escLabel(v){ return Utils.escapeHtml(v); }

  return { start, cancel };
})();

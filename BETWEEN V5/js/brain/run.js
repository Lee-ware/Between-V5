// ===================== BRAIN RUN =====================
// Owns stage lifecycle, timer cancellation, telemetry and the five gameplay
// performance dimensions. It deliberately does not claim to measure IQ or
// general intelligence.

const BrainRun = (() => {
  function clamp(v,min,max){ return Math.max(min,Math.min(max,v)); }

  function progressionForRun(runNumber) {
    const n = Math.max(1, Number(runNumber) || 1);
    const p = BrainConfig.progression;
    if (n <= p.learningRuns) return { level:0, generatorLevel:1, timed:false, phase:'learning' };
    if (n < p.level2StartRun) return { level:1, generatorLevel:1, timed:true, phase:'timed' };
    if (n < p.level3StartRun) return { level:2, generatorLevel:2, timed:true, phase:'timed' };
    if (n < p.level4StartRun) return { level:3, generatorLevel:3, timed:true, phase:'timed' };
    if (n < p.level5StartRun) return { level:4, generatorLevel:4, timed:true, phase:'timed' };
    return { level:5, generatorLevel:5, timed:true, phase:'timed' };
  }

  function chooseLevel(run, stageIndex) {
    // Daily Brain deliberately keeps its existing deterministic stage-based
    // difficulty so the same seeded set remains comparable day-to-day.
    if (run.daily) return clamp(1 + Math.floor(stageIndex / 2), 1, 5);
    return run.progression.level;
  }

  function create({ item, seed, daily=false, runNumber=1 }) {
    let active = true;
    const timers = new Set();
    const stages = [];
    const stageTypes = [];
    const results = [];
    let stageIndex = 0;
    let stageStartedAt = 0;
    let stageLevel = 1;
    let generator = null;
    let rnd = null;
    const progression = daily ? { level:null, generatorLevel:null, timed:true, phase:'daily' } : progressionForRun(runNumber);

    const run = {
      item,
      seed,
      daily,
      runNumber: Math.max(1, Number(runNumber) || 1),
      progression,
      active: true,
      stageIndex: 0,
      get stages(){ return stages; },
      get results(){ return results; },
      get currentStage(){
        if (!stageTypes[stageIndex]) return null;
        if (!stages[stageIndex]) {
          if (typeof generator !== 'function' || typeof rnd !== 'function') return null;
          const level = chooseLevel(run, stageIndex);
          const generatorLevel = run.daily ? level : run.progression.generatorLevel;
          const challenge = generator(stageTypes[stageIndex], generatorLevel, rnd);
          challenge._level = level;
          challenge._generatorLevel = generatorLevel;
          challenge._timed = run.daily ? true : run.progression.timed;
          // Learning sessions measure the task normally but do not impose a
          // deadline. Internal presentation timings (e.g. memory reveal) are
          // left intact because they are part of the mechanic itself.
          if (!challenge._timed) challenge.timeLimit = null;
          stages[stageIndex] = challenge;
        }
        return stages[stageIndex] || null;
      },
      schedule(fn, ms){
        if (!active) return null;
        const id = setTimeout(()=>{ timers.delete(id); if(active) fn(); }, ms);
        timers.add(id); return id;
      },
      cancelTimer(id){ if(id!==null){ clearTimeout(id); timers.delete(id); } },
      cancel(){
        active=false; run.active=false;
        timers.forEach(id=>clearTimeout(id)); timers.clear();
      },
      startStage(challenge){
        if (!active) return false;
        stageStartedAt = performance.now();
        stageLevel = challenge._level || 1;
        return true;
      },
      completeStage({ correct, errors=0, timeMs=null, dimension=null, score=null }){
        if (!active) return false;
        const elapsed = Number.isFinite(timeMs) ? timeMs : Math.max(0, performance.now() - stageStartedAt);
        const challenge = stages[stageIndex];
        const timeLimit = Number.isFinite(challenge?.timeLimit) ? challenge.timeLimit : null;
        const speed = correct && timeLimit ? clamp(1 - Math.max(0, elapsed) / (timeLimit * 1.2), 0, 1) : null;
        const perf = Number.isFinite(score) ? clamp(score,0,1) : (correct ? Math.max(0.55,speed) : 0);
        results.push({
          index:stageIndex, type:challenge.type, title:challenge.title, level:stageLevel,
          correct:correct===true, errors:Math.max(0,Number(errors)||0), timeMs:Math.round(elapsed),
          speed, performance:perf, dimension:dimension || challenge.dimension || 'accuracy'
        });
        stageIndex += 1; run.stageIndex=stageIndex;
        if(stageIndex >= stages.length){
          active=false; run.active=false;
          timers.forEach(id=>clearTimeout(id)); timers.clear();
          return true;
        }
        return false;
      },
      summary(){
        const all=results;
        const accuracy=all.length ? all.filter(r=>r.correct).length/all.length : 0;
        const speedResults=all.filter(r=>r.correct && Number.isFinite(r.speed));
        const speed=speedResults.length ? speedResults.reduce((s,r)=>s+r.speed,0)/speedResults.length : null;
        const memory=all.filter(r=>BrainConfig.memoryTypes.has(r.type));
        const switching=all.filter(r=>BrainConfig.switchingTypes.has(r.type));
        const memoryScore=memory.length ? memory.filter(r=>r.correct).length/memory.length : accuracy;
        const switchingScore=switching.length ? switching.filter(r=>r.correct).length/switching.length : accuracy;
        const mean=all.length ? all.reduce((s,r)=>s+r.performance,0)/all.length : 0;
        const variance=all.length ? all.reduce((s,r)=>s+Math.pow(r.performance-mean,2),0)/all.length : 0;
        const consistency=clamp(1-Math.sqrt(variance)*1.6,0,1);
        const dims={
          Accuracy:Math.round(accuracy*100), Speed:speed===null?null:Math.round(speed*100),
          Memory:Math.round(memoryScore*100), Switching:Math.round(switchingScore*100), Consistency:Math.round(consistency*100)
        };
        // During the untimed learning phase, Speed is not measured and does not
        // contribute a fabricated value to the overall score.
        const weighted = [
          [accuracy,0.35],
          ...(speed===null ? [] : [[speed,0.20]]),
          [memoryScore,0.20],[switchingScore,0.15],[consistency,0.10]
        ];
        const weightTotal=weighted.reduce((s,entry)=>s+entry[1],0);
        const runScore=Math.round(weighted.reduce((s,entry)=>s+entry[0]*entry[1],0)/weightTotal*100);
        return {
          runId:'brainrun_'+Date.now().toString(36), itemId:item.id, itemTitle:item.title,
          daily, runNumber:run.runNumber, brainLevel:run.daily ? null : run.progression.level,
          phase:run.daily ? 'daily' : run.progression.phase,
          timed:run.daily ? true : run.progression.timed,
          daily, seed, completed:results.length===stages.length, stages:results.slice(), dimensions:dims,
          score:runScore, strongest:Object.entries(dims).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'Accuracy',
          startedAt:run.startedAt || null, endedAt:Date.now(), durationMs:results.reduce((s,r)=>s+r.timeMs,0),
        };
      },
      levelForStage(index){ return chooseLevel(run, index); },
      isLearning(){ return !run.daily && run.progression.phase === 'learning'; },
      isTimedStart(){ return !run.daily && run.runNumber === BrainConfig.progression.learningRuns + 1; },
      setPlan(plan, makeChallenge, randomFn){
        stageTypes.splice(0, stageTypes.length, ...plan);
        stages.splice(0, stages.length, ...Array(plan.length).fill(null));
        generator = typeof makeChallenge === 'function' ? makeChallenge : null;
        rnd = typeof randomFn === 'function' ? randomFn : null;
      },
    };
    run.startedAt=Date.now();
    return run;
  }

  return { create };
})();

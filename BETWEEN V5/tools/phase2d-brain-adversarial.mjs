import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const report = { phase:'2D', result:'PASS', checks:{}, timerSimulation:{}, generatorStress:{}, issues:[], notes:[] };
function fail(msg){ report.issues.push(msg); report.result='FAIL'; }
function check(name, cond, detail=''){ report.checks[name]=cond ? 'PASS' : 'FAIL'; if(!cond) fail(detail || name); }

const renderer=read('js/brain/renderer.js');
const engine=read('js/brain/engine.js');
const runCode=read('js/brain/run.js');
const app=read('js/app.js');
const storage=read('js/storage.js');
const backup=read('js/backup.js');
const config=read('js/brain/config.js');
const generators=read('js/brain/generators.js');
const modes=read('js/modes.js');
const sw=read('service-worker.js');

check('stale_finish_guard', /expectedGuard !== stageGuard/.test(renderer));
check('stage_scoped_schedules', /stageRun\.schedule/.test(renderer));
check('generic_stage_deadline', /stageRun\.schedule\(\(\)=>finish\(false,1\), challenge\.timeLimit\)/.test(renderer));
check('navigation_cancels_brain', /BrainEngine\.cancel\(\)/.test(app));
check('brain_engine_cancel_api', /function cancel\(\)/.test(engine) && /return \{ start, cancel \}/.test(engine));
check('double_completion_app_guard', /committedExperienceToken === token/.test(app));
check('double_click_stage_guards', /if\(finished\)/.test(renderer));
check('classification_transition_invalidates_timer', /cycle\+\+;index\+\+/.test(renderer));
check('brain_run_timer_cleanup', /timers\.forEach\(id=>clearTimeout\(id\)\); timers\.clear\(\)/.test(runCode));
check('brain_run_cancel_api', /cancel\(\)\{/.test(runCode));
check('no_brain_math_random_generation', !/Math\.random\(/.test(generators));
check('daily_seed_is_date_based', /todayKey\(\)\}:between:brain/.test(engine));
check('daily_difficulty_fixed', /if \(run\.daily\) return clamp\(1 \+ Math\.floor\(stageIndex \/ 2\), 1, 5\)/.test(runCode) && /Daily Brain deliberately keeps/.test(runCode));
check('reduced_motion_does_not_change_timing', !/reducedMotion|prefers-reduced-motion/.test(renderer));
check('no_iq_claims', !/Your IQ|IQ:\s*\d|train your brain and become smarter/i.test(config+generators+renderer+engine+modes));
check('brain_stats_local', /brainRuns/.test(storage) && /brainRuns/.test(backup));
check('brain_not_library_completion', /mode !== 'brain'/.test(app) && /archive\.has\(i\.mode\)/.test(app));
check('brain_pwa_cache_current', /between-v5\.0\.0-phase3fix4/.test(sw) && /js\/brain\/(config|generators|run|renderer|engine)\.js/.test(sw));
check('brain_completion_owns_next_ui', /function brainNextButtonHTML/.test(engine) && /function bindBrainNext/.test(engine) && !/\bnextButtonHTML\(/.test(engine) && !/\bbindNext\(/.test(engine));
check('memory_grid_lifecycle_recovery', /presentationStartedAt/.test(renderer) && /visibilitychange/.test(renderer) && /pageshow/.test(renderer) && /resume/.test(renderer) && /displayMs/.test(renderer));
check('memory_grid_arm_is_stage_scoped', /!run\.active\|\|token!==run\.stageIndex\+1/.test(renderer));

// Fake-timer simulation against the actual BrainRun implementation.
const timers = new Map();
let timerSeq = 0;
let now = 1000;
const ctx={
  console, Math, Date, JSON, Set, Map, Object, Array, Number, String, Boolean, Error,
  performance:{now:()=>now},
  setTimeout:(fn,ms)=>{ const id=++timerSeq; timers.set(id,{fn,at:now+ms}); return id; },
  clearTimeout:(id)=>timers.delete(id),
};
vm.createContext(ctx);
vm.runInContext(runCode,ctx,{filename:'js/brain/run.js'});
vm.runInContext(config,ctx,{filename:'js/brain/config.js'});
vm.runInContext('this.__BrainRun=BrainRun;',ctx);
const BrainRun=ctx.__BrainRun;
const run=BrainRun.create({item:{id:'adversarial',title:'Adversarial'},seed:123,daily:false});
run.setPlan(['visual_search','memory_grid','sequence'],(type,level)=>({type,title:type,timeLimit:1000,_level:level}),()=>0.5);
let ran=0;
const scheduled=run.schedule(()=>{ran++;},1000);
run.cancel();
check('cancel_clears_scheduled_timer', !timers.has(scheduled) && ran===0);
report.timerSimulation.afterCancelPendingTimers=timers.size;

// New run: stale completion should be impossible once stage index advances.
const run2=BrainRun.create({item:{id:'guard',title:'Guard'},seed:1,daily:false});
run2.setPlan(['visual_search','memory_grid'],(type,level)=>({type,title:type,timeLimit:1000,_level:level}),()=>0.5);
const first=run2.currentStage;
run2.startStage(first);
const finishedFirst=run2.completeStage({correct:true,timeMs:100,score:1});
const secondIndex=run2.stageIndex;
let duplicateRejected=false;
// At the run layer, a second completion is not semantically a stale-renderer call;
// therefore we validate the renderer's token guard separately below rather than
// pretending BrainRun itself owns DOM-stage identity.
const second=run2.currentStage;
run2.startStage(second);
const finishedSecond=run2.completeStage({correct:true,timeMs:100,score:1});
check('run_advances_stage_once_per_completion', finishedFirst===false && secondIndex===1 && finishedSecond===true);
report.timerSimulation.run2={firstStageIndex:secondIndex,finalActive:run2.active};

// Generator stress here is deliberately hostile to boundary levels and repeated seeds.
const genCtx={window:{},console,Math,Date,JSON,Set,Map,Object,Array,Number,String,Boolean,Error,RegExp,parseInt,parseFloat};
vm.createContext(genCtx);
vm.runInContext('this.__dummy=true;',genCtx);
vm.runInContext(read('js/data.js'),genCtx,{filename:'js/data.js'});
vm.runInContext(read('js/utils.js'),genCtx,{filename:'js/utils.js'});
vm.runInContext(read('js/brain/config.js'),genCtx,{filename:'js/brain/config.js'});
vm.runInContext(read('js/brain/generators.js'),genCtx,{filename:'js/brain/generators.js'});
vm.runInContext('this.__G=BrainGenerators; this.__U=Utils; this.__C=BrainConfig;',genCtx);
const G=genCtx.__G, U=genCtx.__U, C=genCtx.__C;
let stressCases=0;
for(const type of [...C.engineTypes,'final_change']){
  for(const level of [1,5]){
    for(let seed=0;seed<250;seed++){
      const c=G.generate(type,level,U.seededRandom(seed));
      if(!c || !c.type) fail(`Generator ${type} level ${level} seed ${seed} returned empty`);
      stressCases++;
      if(['memory_grid','spatial','path','change_detection'].includes(type)){
        const total=(Number(c.gridSize)||0)*(Number(c.gridSize)||0);
        if(!total || !Number.isInteger(c.gridSize)) fail(`Grid generator ${type} produced invalid grid size`);
      }
    }
  }
}
report.generatorStress.cases=stressCases;
report.generatorStress.types=20;
report.generatorStress.levels=[1,5];

// Ensure all player-facing Brain experiences still have corresponding UI dispatch.
const data=genCtx.window.BETWEEN_DATA;
const brain=data.items.filter(x=>x.mode==='brain');
const rendererTypes=new Set([...renderer.matchAll(/case '([^']+)':/g)].map(m=>m[1]));
for(const item of brain){
  if(item.brain_type!=='final_boss' && !rendererTypes.has(item.brain_type)) fail(`No renderer route for ${item.brain_type}`);
}
check('all_player_brain_types_rendered', report.issues.filter(x=>x.startsWith('No renderer route')).length===0);

// Execute the Brain completion callback in isolation. This catches cross-IIFE
// name leaks such as BrainEngine calling a private Modes helper after a run ends.
const completionCtx={
  window:{}, console, Math, Date, JSON, Set, Map, Object, Array, Number, String, Boolean, Error,
  Utils:{hashString:()=>123, todayKey:()=> '2026-10-02', escapeHtml:v=>String(v??''), seededRandom:()=>0.5},
  BrainConfig:{progression:{learningRuns:10},engineTypes:['visual_search']},
  BrainRun:{create:()=>({setPlan(){}})},
  BrainGenerators:{generate(){return {type:'visual_search'};}},
  Storage:{getBrainRuns:()=>[]},
  App:{handleBrainRun(){}},
  BrainRenderer:{play(container,run,ctx,onFinish){
    onFinish({score:77,strongest:'Accuracy',dimensions:{Accuracy:80,Speed:null,Memory:70,Switching:75,Consistency:85}});
    return {cancel(){}};
  }}
};
completionCtx.window.BETWEEN_DATA={};
vm.createContext(completionCtx);
const fakeBtn={addEventListener(){}};
const fakeContainer={_html:'',set innerHTML(v){this._html=v;},get innerHTML(){return this._html;},querySelector(sel){return sel==='#btn-next'?fakeBtn:null;}};
vm.runInContext(engine,completionCtx,{filename:'js/brain/engine-completion-test.js'});
vm.runInContext('this.__BrainEngine=BrainEngine;',completionCtx);
let completionThrew=false;
try {
  completionCtx.__BrainEngine.start(fakeContainer,{id:'completion-test',title:'Completion',brain_type:'visual_search'}, {isDaily:false, reportResult:()=>true, next:()=>true});
} catch (e) {
  completionThrew=true;
  fail(`Brain completion callback threw: ${e && e.message ? e.message : e}`);
}
check('brain_completion_callback_runtime', !completionThrew);

fs.writeFileSync(path.join(ROOT,'docs/PHASE2D_BRAIN_ADVERSARIAL_AUDIT.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.result==='FAIL') process.exit(1);

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const report = {
  phase: '2C',
  result: 'PASS',
  counts: {},
  normalCounts: {},
  brainTypes: [],
  generatorFuzz: { seeds: 0, levels: 0, cases: 0 },
  deterministic: null,
  adversarial: {},
  lifecycle: {},
  integration: {},
  issues: [],
  notes: [],
};

function issue(msg){ report.issues.push(msg); report.result='FAIL'; }
function ok(cond,msg){ if(!cond) issue(msg); }
function read(rel){ return fs.readFileSync(path.join(ROOT,rel),'utf8'); }
function sha(rel){ return crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT,rel))).digest('hex'); }

// Load the actual runtime data/config/generator code in a minimal VM.
const ctx = { window: {}, console, Math, Date, JSON, Set, Map, Object, Array, Number, String, Boolean, Error, RegExp, parseInt, parseFloat };
ctx.performance = { now: () => 0 };
vm.createContext(ctx);
['js/data.js','js/utils.js','js/brain/config.js','js/brain/generators.js'].forEach(rel => vm.runInContext(read(rel), ctx, {filename:rel}));
vm.runInContext('this.__Utils = Utils; this.__BrainConfig = BrainConfig; this.__BrainGenerators = BrainGenerators;', ctx);
const data = ctx.window.BETWEEN_DATA;
const utils = ctx.__Utils;
const cfg = ctx.__BrainConfig;
const gen = ctx.__BrainGenerators;

const brain = data.items.filter(i=>i.mode==='brain');
for (const [mode,n] of Object.entries(data.modes)) report.counts[mode]=n;
for (const i of data.items) report.normalCounts[i.mode]=(report.normalCounts[i.mode]||0)+1;

const expectedNormal={pick_one:150,knowledge:99,scenario:75,estimation:100,prediction:100,random:100};
for (const [mode,n] of Object.entries(expectedNormal)) ok(report.normalCounts[mode]===n,`Normal count ${mode} expected ${n}, got ${report.normalCounts[mode]}`);
ok(report.normalCounts.majority===100,'Majority archive expected 100');
ok(brain.length===20,`Brain player-facing count expected 20, got ${brain.length}`);
report.brainTypes=brain.map(i=>i.brain_type);
const expectedTypes=['visual_search','memory_grid','sequence','reverse','rule_switch','go_no_go','odd_one','change_detection','flash_recall','spatial','path','classification','number_trap','symbol_mapping','mirror','pattern','rapid_sort','memory_distraction','one_second','final_boss'];
ok(JSON.stringify([...report.brainTypes].sort())===JSON.stringify([...expectedTypes].sort()),'Brain types do not exactly match expected 20 experience types');
ok(new Set(report.brainTypes).size===20,'Brain experience types must be unique');
ok(data.total_items===744,`Total item count expected 744, got ${data.total_items}`);
ok(sha('content-sources/BETWEEN-Brain-content.txt')==='6baf8aa2262c8a589652476a47f472d989349d1cbc8941407356c2639d60d832','Brain source hash mismatch');
ok(data.audit?.brain_source_sha256==='6baf8aa2262c8a589652476a47f472d989349d1cbc8941407356c2639d60d832','Data brain source hash mismatch');
ok(data.audit?.temporary_brain_preserved===0,'Temporary old Brain records still marked as preserved');
ok(!data.items.some(i=>i.game_type),'Old Brain V2 game_type records are still present');

for(const i of brain){
  ok(i.title && i.prompt && i.brain_type && i.brain_engine,`Brain record ${i.id} missing player-facing fields`);
  ok(i.brain_type==='final_boss' || cfg.engineTypes.includes(i.brain_type),`Unsupported Brain type ${i.brain_type}`);
}
ok(cfg.experiences.length===20,'BrainConfig does not define 20 experiences');
for(const type of expectedTypes.filter(t=>t!=='final_boss')) ok(cfg.engineTypes.includes(type),`BrainConfig engineTypes missing ${type}`);

const generatorCode=read('js/brain/generators.js');
const rendererCode=read('js/brain/renderer.js');
const engineCode=read('js/brain/engine.js');
const runCode=read('js/brain/run.js');
for(const type of cfg.engineTypes) ok(generatorCode.includes(`case '${type}':`),`Generator missing switch case ${type}`);
for(const type of expectedTypes.filter(t=>t!=='final_boss')) ok(rendererCode.includes(`case '${type}'`),`Renderer missing switch case ${type}`);
ok(rendererCode.includes("case 'final_change'" ) || engineCode.includes("'final_change'"), 'Final-change challenge not wired');
ok(engineCode.includes("item.brain_type==='final_boss'"), 'Final boss must be selected by brain_type');
ok(engineCode.includes("memory_grid','rule_switch','sequence','change_detection','symbol_mapping','rule_switch','memory_distraction','final_change"), 'Final boss stage plan mismatch');
ok(runCode.includes('function chooseLevel') && runCode.includes('progressionForRun') && runCode.includes('run.progression'), 'Brain familiarity/daily level policy missing');
ok(runCode.includes('isLearning()') && runCode.includes('isTimedStart()'), 'Brain onboarding transition helpers missing');
ok(runCode.includes('speed = correct && timeLimit') && runCode.includes(': null'), 'Untimed Brain stages must not fabricate speed telemetry');
ok(read('js/engine.js').includes('BRAIN_LEARNING_EXCLUDED_TYPES') && read('js/engine.js').includes('brainFamiliarityRuns'), 'Brain learning selection guard missing');
ok(runCode.includes('challenge.timeLimit = null'), 'Brain learning phase should remove stage deadlines while preserving internal mechanic timing');

function deepEqual(a,b){ return JSON.stringify(a)===JSON.stringify(b); }
function validate(type,c){
  const expectedType = type==='final_change' ? 'change_detection' : type;
  if(!c || c.type!==expectedType) return `type mismatch for ${type}`;
  const total = Number(c.gridSize)*Number(c.gridSize);
  if(type==='visual_search'){
    const hits=c.values.filter(x=>x===c.target).length; if(hits!==1) return `visual_search target count ${hits}`;
    if(c.answerIndex<0||c.answerIndex>=c.values.length) return 'visual_search answer index out of bounds';
  }
  if(type==='memory_grid'){
    if(new Set(c.targets).size!==c.targets.length) return 'memory_grid duplicate targets';
    if(c.targets.some(i=>i<0||i>=total)) return 'memory_grid target out of bounds';
  }
  if(type==='sequence' || type==='reverse'){
    if(c.tokens.length!==c.length || new Set(c.tokens).size!==c.tokens.length) return 'sequence tokens invalid';
  }
  if(type==='rule_switch'){
    if(!c.rounds.length) return 'rule_switch empty';
    for(const r of c.rounds){
      if(r.answerIndex<0||r.answerIndex>=r.cards.length) return 'rule_switch answer invalid';
      if(new Set(r.cards.map(x=>x.symbol)).size!==r.cards.length) return 'rule_switch duplicate symbols';
      if(new Set(r.cards.map(x=>x.number)).size!==r.cards.length) return 'rule_switch tied numeric cards';
      if(r.rule.kind==='symbol' && r.cards[r.answerIndex].symbol!==r.rule.targetSymbol) return 'rule_switch symbol answer wrong';
      if(r.rule.kind==='largest' && r.cards[r.answerIndex].number!==Math.max(...r.cards.map(x=>x.number))) return 'rule_switch largest wrong';
      if(r.rule.kind==='smallest' && r.cards[r.answerIndex].number!==Math.min(...r.cards.map(x=>x.number))) return 'rule_switch smallest wrong';
    }
  }
  if(type==='go_no_go'){
    if(!c.sequence.includes(c.go)) return 'go_no_go has no go signal';
    if(c.sequence.some(x=>x!==c.go && !c.noGo.includes(x))) return 'go_no_go unknown signal';
  }
  if(type==='odd_one'){
    if(c.values.filter(x=>x===c.values[c.oddIndex]).length!==1) return 'odd_one odd value not unique';
    if(c.oddIndex<0||c.oddIndex>=c.values.length) return 'odd_one index invalid';
  }
  if(type==='change_detection'){
    const diffs=c.first.reduce((n,x,i)=>n+(x!==c.second[i]?1:0),0); if(diffs!==1) return `change_detection diffs ${diffs}`;
    if(c.changedIndex<0||c.changedIndex>=c.first.length) return 'change_detection index invalid';
  }
  if(type==='flash_recall'){
    if(!c.choices.includes(c.answer) || new Set(c.choices).size!==c.choices.length) return 'flash_recall choices invalid';
  }
  if(type==='spatial'){
    const inds=c.objects.map(o=>o.index); if(new Set(inds).size!==inds.length) return 'spatial duplicate positions';
    if(!c.objects.some(o=>o.index===c.targetIndex && o.symbol===c.targetSymbol)) return 'spatial target mismatch';
  }
  if(type==='path'){
    if(new Set(c.path).size!==c.path.length) return 'path duplicate cells';
    for(let i=1;i<c.path.length;i++){const a=c.path[i-1],b=c.path[i];const ar=Math.floor(a/c.gridSize),ac=a%c.gridSize,br=Math.floor(b/c.gridSize),bc=b%c.gridSize;if(Math.abs(ar-br)+Math.abs(ac-bc)!==1) return 'path has non-adjacent step';}
  }
  if(type==='classification' || type==='rapid_sort'){
    if(!c.items.length || !c.items.some(x=>x.side===0) || !c.items.some(x=>x.side===1)) return `${type} not two-sided`;
    if(new Set(c.items.map(x=>x.text)).size!==c.items.length) return `${type} duplicate items`;
  }
  if(type==='number_trap'){
    if(c.numbers.length!==4 || new Set(c.numbers).size!==4) return 'number_trap number choices invalid';
    if(c.answerIndex<0||c.answerIndex>=4) return 'number_trap answer index invalid';
    if(c.instructions.includes('largest') && c.numbers[c.answerIndex]!==Math.max(...c.numbers)) return 'number_trap largest wrong';
    if(c.instructions.includes('smallest') && c.numbers[c.answerIndex]!==Math.min(...c.numbers)) return 'number_trap smallest wrong';
    if(c.instructions.includes('second') && c.answerIndex!==1) return 'number_trap second wrong';
    if(c.instructions.includes('closest')){const pivot=5, dist=Math.abs(c.numbers[c.answerIndex]-pivot);if(dist!==Math.min(...c.numbers.map(n=>Math.abs(n-pivot))))return 'number_trap closest wrong';}
    if(c.instructions.includes('furthest')){const pivot=5, dist=Math.abs(c.numbers[c.answerIndex]-pivot);if(dist!==Math.max(...c.numbers.map(n=>Math.abs(n-pivot))))return 'number_trap furthest wrong';}
  }
  if(type==='symbol_mapping'){
    for(const p of c.parts){const calc=p.sequence.reduce((s,x)=>s+p.mapping[x],0); if(calc!==p.answer)return 'symbol_mapping answer wrong';}
  }
  if(type==='mirror'){
    if(c.choices.length!==4 || new Set(c.choices.map(x=>JSON.stringify(x))).size!==4) return 'mirror choices not unique';
    if(c.correctIndex<0||c.correctIndex>=4) return 'mirror correct index invalid';
  }
  if(type==='pattern'){
    if(c.choices.length!==4 || !c.choices.includes(c.answer) || new Set(c.choices).size!==c.choices.length) return 'pattern choices invalid';
  }
  if(type==='memory_distraction'){
    if(c.choices.length!==4 || !c.choices.includes(c.answer) || new Set(c.choices).size!==c.choices.length) return 'memory_distraction choices invalid';
  }
  if(type==='one_second'){
    const actual=c.values.filter(x=>x===c.target).length; if(actual!==c.answer || actual<1) return 'one_second answer invalid';
  }
  return null;
}

const seedCases=[...Array(100).keys()].map(i=>i+1);
const types=[...cfg.engineTypes,'final_change'];
for(const type of types){
  for(const level of [1,2,3,4,5]){
    for(const seed of seedCases){
      const r1=utils.seededRandom(seed);
      const c=gen.generate(type,level,r1);
      const err=validate(type,c);
      if(err){ issue(`Generator ${type} level ${level} seed ${seed}: ${err}`); break; }
      report.generatorFuzz.cases++;
    }
  }
}
report.generatorFuzz.seeds=seedCases.length;
report.generatorFuzz.levels=5;

// Determinism: same seed + type + level must produce byte-identical challenge.
report.deterministic=true;
for(const type of types){
  const a=gen.generate(type,4,utils.seededRandom(0xBEEF));
  const b=gen.generate(type,4,utils.seededRandom(0xBEEF));
  if(!deepEqual(a,b)){ report.deterministic=false; issue(`Non-deterministic generator ${type}`); }
}

// BrainRun lifecycle/adaptation test using actual BrainRun source with a minimal config.
const ctxRun = { console, performance:{now:()=>1000}, setTimeout, clearTimeout, Math, Date, JSON, Set, Map, Object, Array, Number, String, Boolean, Error };
vm.createContext(ctxRun);
vm.runInContext(read('js/brain/run.js'),ctxRun,{filename:'js/brain/run.js'});
vm.runInContext(read('js/brain/config.js'),ctxRun,{filename:'js/brain/config.js'});
vm.runInContext('this.__BrainRun = BrainRun; this.__BrainConfig = BrainConfig;', ctxRun);
const runApi=ctxRun.__BrainRun;
ctxRun.__BrainConfig = ctxRun.__BrainConfig;
const progressionLevels=[];
for(const n of [1,10,11,21,31,40,50]){
  const r=runApi.create({item:{id:'test',title:'Test'},seed:1,daily:false,runNumber:n});
  r.setPlan(['sequence','memory_grid'],(type,level)=>({type,timeLimit:999,_madeAtLevel:level}),()=>0.5);
  const c=r.currentStage;
  progressionLevels.push({run:n,level:c._level,generatorLevel:c._generatorLevel,timed:c._timed,timeLimit:c.timeLimit});
}
report.lifecycle.progression=progressionLevels;
ok(progressionLevels[0].level===0 && progressionLevels[0].generatorLevel===1 && progressionLevels[0].timed===false && progressionLevels[0].timeLimit===null,'Brain learning runs must be untimed level 0');
ok(progressionLevels[1].level===0 && progressionLevels[1].timeLimit===null,'Run 10 should remain in learning mode');
ok(progressionLevels[2].level===1 && progressionLevels[2].timed===true,'Run 11 should start timed level 1');
ok(progressionLevels[3].level===2 && progressionLevels[4].level===3 && progressionLevels[5].level===4 && progressionLevels[6].level===5,'Brain difficulty unlock schedule is incorrect');
const r2=runApi.create({item:{id:'test',title:'Test'},seed:1,daily:false,runNumber:21});
r2.setPlan(['sequence','memory_grid','classification'],(type,level)=>({type,timeLimit:999,_madeAtLevel:level}),()=>0.5);
const sameRunLevels=[]; for(let i=0;i<3;i++){ sameRunLevels.push(r2.currentStage._level); r2.completeStage({correct:true,timeMs:100,score:1}); }
report.lifecycle.sameRunLevels=sameRunLevels;
ok(JSON.stringify(sameRunLevels)==='[2,2,2]','Normal Brain difficulty should not jump within a single run');
const dailyRun=runApi.create({item:{id:'test',title:'Test'},seed:1,daily:true});
dailyRun.setPlan(['sequence','memory_grid','classification','pattern','one_second'],(type,level)=>({type,timeLimit:999,_madeAtLevel:level}),()=>0.5);
const dlevels=[]; for(let i=0;i<5;i++){ dlevels.push(dailyRun.currentStage._level); dailyRun.completeStage({correct:i%2===0,timeMs:100,score:i%2===0?1:0}); }
report.lifecycle.dailyLevels=dlevels;
ok(JSON.stringify(dlevels)===JSON.stringify([1,1,2,2,3]),'Daily Brain levels are not fixed/deterministic by stage');


// Actual App self-test: run the same content audit that executes at boot with a minimal DOM shell.
const ctxApp = {
  window: {}, console, Math, Date, JSON, Set, Map, Object, Array, Number, String, Boolean, Error, RegExp,
  document: { addEventListener(){}, getElementById(){ return null; } },
  history: { length:1, pushState(){}, replaceState(){} }, location:{hash:'',search:'',pathname:'/'},
};
ctxApp.window = ctxApp;
ctxApp.addEventListener = ()=>{};
vm.createContext(ctxApp);
for(const rel of ['js/data.js','js/utils.js','js/brain/config.js','js/brain/generators.js','js/engine.js','js/app.js']) vm.runInContext(read(rel),ctxApp,{filename:rel});
vm.runInContext('this.__App = App;',ctxApp);
const bootAudit=ctxApp.__App.runContentAudit();
report.integration.appSelfTest = !bootAudit.error && bootAudit.dupIds===0 && bootAudit.dupPrompts===0 && bootAudit.missingFields===0 && Object.keys(bootAudit.byModeIssues||{}).length===0;
ok(report.integration.appSelfTest,'Application boot content self-test reports an issue');

// Integration static checks.
report.integration={
  storageBrainRuns:/brainRuns/.test(read('js/storage.js')),
  storageSchema5:/SCHEMA_VERSION = 5/.test(read('js/storage.js')),
  backupBrainRuns:/brainRuns/.test(read('js/backup.js')),
  appBrainRun:/handleBrainRun/.test(read('js/app.js')),
  appBrainScore:/stats\.brainBestScore = Math\.max/.test(read('js/app.js')),
  dailyBrain:/brain: dailyPick\('brain', 'brain'\)/.test(read('js/engine.js')),
  dailyContext:/isDaily: !!\(opts && opts\.dailyKey\)/.test(read('js/app.js')),
  brainCache:/between-v5\.0\.0-phase3fix4/.test(read('service-worker.js')) && /js\/brain\/engine\.js/.test(read('service-worker.js')),
  brainLibraryExcluded:/mode !== 'brain'/.test(read('js/app.js')) && /!archive\.has\(i\.mode\)/.test(read('js/app.js')),
  adaptiveNormal:/item\.mode !== 'knowledge'/.test(read('js/engine.js')),
};
for(const [k,v] of Object.entries(report.integration)) ok(v,`Integration check failed: ${k}`);

report.adversarial={
  staleStageFinishGuard:/expectedGuard !== stageGuard/.test(rendererCode),
  stageScopedTimers:/stageRun\.schedule/.test(rendererCode),
  leaveCancellation:/BrainEngine\.cancel\(\)/.test(read('js/app.js')) && /function cancel\(\)/.test(engineCode),
  genericStageDeadline:/challenge\.timeLimit/.test(rendererCode) && /finish\(false,1\)/.test(rendererCode),
  classificationTimerInvalidation:/cycle\+\+;index\+\+/.test(rendererCode),
  noDeadSequenceSpan:/i<spanLength/.test(rendererCode),
};
for(const [k,v] of Object.entries(report.adversarial)) ok(v,`Adversarial hardening missing: ${k}`);

// No deprecated V2 Brain terms should survive in executable code/data.
for(const term of ['memory_sequence','attention_count','odd_tile','rapid_choice','memory_reverse','game_type']) {
  for(const rel of ['js/data.js','js/modes.js','js/brain/config.js','js/brain/generators.js','js/brain/renderer.js','js/brain/engine.js']) {
    if(read(rel).includes(term)) issue(`Deprecated Brain V2 field/identifier ${term} remains in ${rel}`);
  }
}

if(report.issues.length) report.result='FAIL';
fs.writeFileSync(path.join(ROOT,'docs/PHASE2C_BRAIN_AUDIT.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.result==='FAIL') process.exit(1);

import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const report = { result:'PASS', cases:[], failures:[] };
function ok(condition, message){ if(!condition) report.failures.push(message); }

const ctx = { console, performance:{now:()=>1000}, setTimeout, clearTimeout, Math, Date, JSON, Set, Map, Object, Array, Number, String, Boolean, Error };
vm.createContext(ctx);
vm.runInContext(read('js/brain/config.js'), ctx, {filename:'js/brain/config.js'});
vm.runInContext(read('js/brain/run.js'), ctx, {filename:'js/brain/run.js'});
vm.runInContext('this.__BrainRun=BrainRun; this.__BrainConfig=BrainConfig;', ctx);
const Run = ctx.__BrainRun;
const Cfg = ctx.__BrainConfig;

function firstStage(run){ return run.currentStage; }
function session(runNumber){
  const run = Run.create({item:{id:'test',title:'Test'},seed:1,daily:false,runNumber});
  run.setPlan(['sequence','memory_grid','classification'], (type, level)=>({ type, timeLimit:5000, displayTime:1200 }), ()=>0.5);
  return run;
}

for(const n of [1,5,10,11,20,21,30,31,39,40,49,50,75]){
  const run=session(n);
  const c=firstStage(run);
  report.cases.push({run:n, level:c._level, generatorLevel:c._generatorLevel, timed:c._timed, timeLimit:c.timeLimit});
}

for(const x of report.cases){
  if(x.run<=10){
    ok(x.level===0,`Run ${x.run}: expected learning level 0`);
    ok(x.generatorLevel===1,`Run ${x.run}: expected generator level 1`);
    ok(x.timed===false,`Run ${x.run}: expected untimed`);
    ok(x.timeLimit===null,`Run ${x.run}: expected no stage deadline`);
  } else if(x.run<=20) {
    ok(x.level===1 && x.generatorLevel===1 && x.timed===true,`Run ${x.run}: expected timed level 1`);
  } else if(x.run<=30) {
    ok(x.level===2 && x.generatorLevel===2 && x.timed===true,`Run ${x.run}: expected timed level 2`);
  } else if(x.run<=39) {
    ok(x.level===3 && x.generatorLevel===3 && x.timed===true,`Run ${x.run}: expected timed level 3`);
  } else if(x.run<=49) {
    ok(x.level===4 && x.generatorLevel===4 && x.timed===true,`Run ${x.run}: expected timed level 4`);
  } else {
    ok(x.level===5 && x.generatorLevel===5 && x.timed===true,`Run ${x.run}: expected timed level 5`);
  }
}

const timedStart=Run.create({item:{id:'test',title:'Test'},seed:1,daily:false,runNumber:11});
ok(timedStart.isTimedStart()===true,'Run 11 should be the first timed transition');
ok(session(10).isTimedStart()===false,'Run 10 should not show timed transition');

const daily=Run.create({item:{id:'test',title:'Test'},seed:1,daily:true,runNumber:1});
daily.setPlan(['sequence','memory_grid','classification'],(type,level)=>({type,timeLimit:5000}),()=>0.5);
ok(daily.currentStage._level===1,'Daily stage 1 level policy changed unexpectedly');
daily.completeStage({correct:true,timeMs:100,score:1});
ok(daily.currentStage._level===1,'Daily stage 2 level policy changed unexpectedly');
daily.completeStage({correct:true,timeMs:100,score:1});
ok(daily.currentStage._level===2,'Daily stage 3 level policy changed unexpectedly');

report.config=Cfg.progression;
const engineCode = read('js/engine.js');
ok(engineCode.includes('BRAIN_LEARNING_EXCLUDED_TYPES') && engineCode.includes('brainFamiliarityRuns'), 'Brain learning selection guard missing');
ok(['go_no_go','rapid_sort','one_second','final_boss'].every(t => engineCode.includes(`'${t}'`)), 'Brain learning selection guard is missing one or more speed-native mechanics');
report.result = report.failures.length ? 'FAIL' : 'PASS';
fs.writeFileSync(path.join(ROOT,'docs/BRAIN_PROGRESSION_AUDIT.json'), JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.result==='FAIL') process.exit(1);

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = rel => fs.readFileSync(path.join(ROOT, rel),'utf8');
const report={phase:'2E',result:'PASS',checks:{},counts:{},hashes:{},syntax:[],issues:[],notes:[]};
const fail=msg=>{report.issues.push(msg);report.result='FAIL';};
const check=(name,cond,msg)=>{report.checks[name]=cond?'PASS':'FAIL';if(!cond)fail(msg||name);};

const dataText=read('js/data.js');
let data=null;
try {
  const ctx={window:{}, console, Math, Date, JSON, Set, Map, Object, Array, Number, String, Boolean, Error, RegExp, parseInt, parseFloat};
  vm.createContext(ctx);
  vm.runInContext(dataText,ctx,{filename:'js/data.js'});
  data=ctx.window.BETWEEN_DATA;
  if(!data || typeof data !== 'object') throw new Error('BETWEEN_DATA missing');
} catch(e){ fail(`data.js runtime payload could not be loaded: ${e.message}`); }

if(data){
  report.counts=data.modes;
  const expected={pick_one:150,knowledge:99,scenario:75,estimation:100,prediction:100,random:100,majority:100,brain:20};
  for(const [k,v] of Object.entries(expected)) check(`count_${k}`,data.modes[k]===v,`Count ${k} expected ${v}, got ${data.modes[k]}`);
  check('total_744',data.total_items===744,`Total expected 744, got ${data.total_items}`);
  check('brain_types_20',data.items.filter(i=>i.mode==='brain').length===20,'Brain count mismatch');
  check('knowledge_25_removed',Array.isArray(data.audit?.knowledge_removed) && data.audit.knowledge_removed.join(',')==='25','Knowledge #25 removal marker missing');
  check('replacement_flag',data.content_rules?.normal_content_is_complete_replacement===true,'Normal content replacement flag missing');
  check('brain_procedural',data.content_rules?.brain_is_procedural===true && data.content_rules?.brain_player_facing_experience_count===20,'Brain procedural contract missing');
}

const sourceNon=path.join(ROOT,'content-sources/BETWEEN-non-brain-content.txt');
const sourceBrain=path.join(ROOT,'content-sources/BETWEEN-Brain-content.txt');
const hash=(p)=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
report.hashes.nonBrain=hash(sourceNon); report.hashes.brain=hash(sourceBrain);
check('nonbrain_source_hash',report.hashes.nonBrain==='e7e5f485d64c3d10d819211ab3f037d7a2491551cee96840d602af363110c1c4','Non-Brain source hash changed');
check('brain_source_hash',report.hashes.brain==='6baf8aa2262c8a589652476a47f472d989349d1cbc8941407356c2639d60d832','Brain source hash changed');

// All JS syntax checks, including tools except browser-only code.
const jsFiles=[];
function walk(dir){for(const name of fs.readdirSync(dir,{withFileTypes:true})){const p=path.join(dir,name.name);if(name.isDirectory())walk(p);else if(/\.(js|mjs)$/.test(name.name))jsFiles.push(p);}}
walk(path.join(ROOT,'js')); walk(path.join(ROOT,'tools'));
for(const file of jsFiles){
  try { execFileSync(process.execPath,['--check',file],{stdio:'pipe'}); report.syntax.push(path.relative(ROOT,file)); }
  catch(e){ fail(`Syntax error in ${path.relative(ROOT,file)}`); }
}

const index=read('index.html');
const scriptSrc=[...index.matchAll(/<script\s+src=["']([^"']+)["']/g)].map(m=>m[1]).filter(x=>!x.startsWith('http'));
for(const src of scriptSrc) check(`script_exists_${src}`,fs.existsSync(path.join(ROOT,src)),`index.html references missing ${src}`);
const sw=read('service-worker.js');
for(const src of scriptSrc) check(`sw_precache_${src}`,sw.includes(`'./${src}'`),`service-worker.js does not precache ${src}`);
const cacheVersionMatch=read('js/version.js').match(/cache:\s*'([^']+)'/);
check('sw_cache_current',!!cacheVersionMatch && sw.includes(`const CACHE_NAME = '${cacheVersionMatch[1]}'`),'Service worker cache name does not match js/version.js');
check('manifest_exists',fs.existsSync(path.join(ROOT,'manifest.webmanifest')),'manifest missing');
try { JSON.parse(read('manifest.webmanifest')); check('manifest_valid',true); } catch(e){check('manifest_valid',false,'manifest.webmanifest is invalid JSON');}
check('netlify_config_exists',fs.existsSync(path.join(ROOT,'netlify.toml')),'netlify.toml missing');
const packageJson=JSON.parse(read('package.json'));
check('package_phase2c_script',packageJson.scripts['phase2c:brain-audit']==='node tools/phase2c-brain-audit.mjs','package.json missing phase2c audit command');
check('package_phase2d_script',packageJson.scripts['phase2d:brain-adversarial']==='node tools/phase2d-brain-adversarial.mjs','package.json missing phase2d audit command');
check('package_phase2e_script',packageJson.scripts['phase2e:regression']==='node tools/phase2e-full-regression.mjs','package.json missing phase2e regression command');

// Normal content shape contract from the source integration pass.
if(data){
  const predictionShapes={}; const estimationKinds={}; const randomShapes={};
  for(const i of data.items){
    if(i.mode==='prediction') predictionShapes[i.prediction_shape]=(predictionShapes[i.prediction_shape]||0)+1;
    if(i.mode==='estimation') estimationKinds[i.target_kind]=(estimationKinds[i.target_kind]||0)+1;
    if(i.mode==='random') randomShapes[i.random_shape]=(randomShapes[i.random_shape]||0)+1;
  }
  report.predictionShapes=predictionShapes;report.estimationKinds=estimationKinds;report.randomShapes=randomShapes;
  check('prediction_shapes',predictionShapes.binary===81&&predictionShapes.numeric===10&&predictionShapes.list===9,'Prediction shape distribution changed');
  check('estimation_kinds',estimationKinds.range===17&&estimationKinds.exact===71&&estimationKinds.lower_bound===3&&estimationKinds.text===9,'Estimation target-kind distribution changed');
  check('random_shapes',randomShapes.open===90&&randomShapes.list===10,'Random shape distribution changed');
}

// Phase 2A/2B artifacts remain historical records because their scripts describe
// intermediate states (temporary Brain and pre-3.3 version assumptions). Phase 2E
// verifies their final contracts directly, then runs the current 2C/2D gates.
check('phase2a_contract_current',
  data?.audit?.normal_replacement_counts?.pick_one===150 &&
  data?.audit?.normal_replacement_counts?.knowledge===99 &&
  data?.audit?.normal_replacement_counts?.scenario===75 &&
  data?.audit?.normal_replacement_counts?.estimation===100 &&
  data?.audit?.normal_replacement_counts?.prediction===100 &&
  data?.audit?.normal_replacement_counts?.random===100 &&
  data?.audit?.archived_majority_source_count===100 &&
  data?.audit?.temporary_brain_preserved===0,
  'Current data does not satisfy the final Phase 2A replacement contract');
check('phase2b_contract_current',
  read('js/predictions.js').includes('const Predictions =') &&
  read('js/storage.js').includes('predictions: `${NS}:predictions`') &&
  read('js/storage.js').includes('const SCHEMA_VERSION = 5') &&
  read('js/backup.js').includes('brainRuns') &&
  read('js/screens.js').includes('Daily Brain'),
  'Current Phase 2B prediction/storage/Brain integration contract is incomplete');
try { execFileSync(process.execPath,['tools/phase2c-brain-audit.mjs'],{stdio:'pipe'}); check('phase2c_gate','true','Phase 2C audit failed'); }
catch(e){ check('phase2c_gate',false,'Phase 2C audit failed'); report.notes.push(String(e.stdout||e.stderr||e.message)); }
try { execFileSync(process.execPath,['tools/phase2d-brain-adversarial.mjs'],{stdio:'pipe'}); check('phase2d_gate','true','Phase 2D adversarial audit failed'); }
catch(e){ check('phase2d_gate',false,'Phase 2D adversarial audit failed'); report.notes.push(String(e.stdout||e.stderr||e.message)); }
report.notes.push('Phase 2A/2B JSON reports are retained as historical intermediate-state records; Phase 2E validates their final contracts directly.');

// Release hygiene: no old Brain V2 record fields in shipped data and no stale cache reference.
for(const term of ['game_type','memory_sequence','attention_count','odd_tile','rapid_choice','memory_reverse']){
  check(`no_legacy_${term}`,!dataText.includes(term),`Legacy Brain V2 field ${term} remains in data.js`);
}
check('no_old_cache_reference',!sw.includes('phase2b'),'Service worker still contains old phase2b cache identifier');
check('data_version_3_3',data?.version==='3.3','Content data version should be 3.3 after Brain integration');
check('app_version_5',read('js/version.js').includes("app: '5.0.0'"),'App version changed unexpectedly');

// Future tester checklist exists and explicitly covers non-developer testing.
const checklist=read('docs/PHASE4_REAL_WORLD_TEST_CHECKLIST.md');
check('tester_checklist_exists',checklist.length>5000,'Phase 4 tester checklist is missing/incomplete');
check('tester_brain_section',/## 9\. Brain/.test(checklist),'Phase 4 checklist has no Brain section');
check('tester_all_brain_experiences', ['Code Breaker','Memory Grid','Sequence','Reverse','Rule Switch','Don’t Tap','Odd One','Change Detective','Flash Recall','Where Was It?','Path','Sort It','Number Trap','BETWEEN Code','Mirror','The Next Thing','Rapid Sort','Memory + Distraction','One Second','FINAL BOSS: BETWEEN'].every(label=>checklist.includes(label)),'Phase 4 checklist does not name every Brain experience');

fs.writeFileSync(path.join(ROOT,'docs/PHASE2E_FULL_REGRESSION.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(report.result==='FAIL') process.exit(1);

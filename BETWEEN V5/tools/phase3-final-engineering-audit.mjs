import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const report = {
  phase: '3',
  result: 'PASS',
  checks: {},
  counts: {},
  hashes: {},
  storageSimulation: {},
  security: {},
  notes: [],
  issues: [],
};
const fail = (name, msg) => { report.checks[name] = 'FAIL'; report.issues.push(msg || name); report.result = 'FAIL'; };
const pass = (name, msg) => { report.checks[name] = 'PASS'; if (msg) report.notes.push(msg); };
const check = (name, cond, msg) => cond ? pass(name) : fail(name, msg);
const sha = rel => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, rel))).digest('hex');

// ---------- Source/data contract ----------
let data = null;
try {
  const ctx = { window: {}, console, Math, Date, JSON, Set, Map, Object, Array, Number, String, Boolean, Error, RegExp, parseInt, parseFloat };
  vm.createContext(ctx);
  vm.runInContext(read('js/data.js'), ctx, { filename: 'js/data.js' });
  data = ctx.window.BETWEEN_DATA;
  check('data_runtime_loads', !!data && typeof data === 'object', 'BETWEEN_DATA failed to load in a clean VM');
} catch (e) {
  fail('data_runtime_loads', `BETWEEN_DATA failed to load: ${e.message}`);
}
if (data) {
  const expected = { pick_one: 150, knowledge: 99, scenario: 75, estimation: 100, prediction: 100, random: 100, majority: 100, brain: 20 };
  report.counts = data.modes;
  check('data_total_744', data.total_items === 744, `Expected 744 total, got ${data.total_items}`);
  for (const [k, n] of Object.entries(expected)) check(`data_count_${k}`, data.modes[k] === n, `${k} expected ${n}, got ${data.modes[k]}`);
  const ids = data.items.map(x => x.id);
  const prompts = data.items.map(x => x.prompt);
  check('data_unique_ids', new Set(ids).size === ids.length, 'Duplicate content IDs found');
  const promptModeCounts = {};
for (const i of data.items) { const key = `${i.mode}\u0000${i.prompt}`; promptModeCounts[key] = (promptModeCounts[key] || 0) + 1; }
const duplicatePromptModeKeys = Object.entries(promptModeCounts).filter(([,n])=>n>1);
check('data_duplicate_prompt_review', duplicatePromptModeKeys.every(([key]) => {
  const [mode,prompt] = key.split('\u0000');
  const rows = data.items.filter(i=>i.mode===mode && i.prompt===prompt);
  return rows.every(i => Array.isArray(i.options) && i.options.length>0) && new Set(rows.map(i=>JSON.stringify(i.options))).size===rows.length;
}), 'Duplicate prompt stems within the same mode do not have differentiated options');
const duplicatePromptLabels = duplicatePromptModeKeys.map(([key,n]) => { const [mode,prompt]=key.split('\u0000'); return `${mode}:${JSON.stringify(prompt)}:${n}`; });
report.notes.push(`Exact repeated prompt stems within the same mode reviewed: ${duplicatePromptModeKeys.length} (${duplicatePromptLabels.join(', ') || 'none'}). Cross-mode repeated prompts are allowed when the gameplay mode differs.`);
  check('data_no_knowledge_25', !data.items.some(x => x.mode === 'knowledge' && x.id === 'v5-knowledge-025'), 'Knowledge #25 still present');
  check('data_replacement_flag', data.content_rules?.normal_content_is_complete_replacement === true, 'Replacement contract missing');
  check('data_brain_procedural', data.content_rules?.brain_is_procedural === true && data.content_rules?.brain_player_facing_experience_count === 20, 'Brain procedural contract missing');
  check('data_no_legacy_brain_records', !data.items.some(x => x.game_type || ['memory_sequence','attention_count','odd_tile','rapid_choice','memory_reverse'].includes(x.brain_type)), 'Legacy Brain V2 record/field found');
}

report.hashes.nonBrain = sha('content-sources/BETWEEN-non-brain-content.txt');
report.hashes.brain = sha('content-sources/BETWEEN-Brain-content.txt');
check('source_nonbrain_exact', report.hashes.nonBrain === 'e7e5f485d64c3d10d819211ab3f037d7a2491551cee96840d602af363110c1c4', 'Non-Brain source hash changed');
check('source_brain_exact', report.hashes.brain === '6baf8aa2262c8a589652476a47f472d989349d1cbc8941407356c2639d60d832', 'Brain source hash changed');

// ---------- Static code quality ----------
const jsFiles = [];
function walk(dir) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p);
    else if (/\.(js|mjs)$/.test(ent.name)) jsFiles.push(p);
  }
}
walk(path.join(ROOT, 'js')); walk(path.join(ROOT, 'tools'));
let syntaxFailures = 0;
for (const f of jsFiles) {
  try { execFileSync(process.execPath, ['--check', f], { stdio: 'pipe' }); }
  catch { syntaxFailures += 1; report.issues.push(`Syntax error in ${path.relative(ROOT, f)}`); }
}
check('all_js_syntax', syntaxFailures === 0, `${syntaxFailures} JavaScript syntax check(s) failed`);

const index = read('index.html');
const scriptSrc = [...index.matchAll(/<script\s+src=["']([^"']+)["']/g)].map(m => m[1]).filter(x => !x.startsWith('http'));
check('index_script_count', scriptSrc.length >= 20, `Unexpectedly small script set: ${scriptSrc.length}`);
for (const src of scriptSrc) check(`index_ref_${src}`, fs.existsSync(path.join(ROOT, src)), `Missing index script ${src}`);

const sw = read('service-worker.js');
for (const src of scriptSrc) check(`sw_precache_${src}`, sw.includes(`'./${src}'`), `Service worker does not precache ${src}`);
const ver = read('js/version.js');
const cacheMatch = ver.match(/cache:\s*'([^']+)'/);
check('sw_version_cache_match', !!cacheMatch && sw.includes(`const CACHE_NAME = '${cacheMatch[1]}'`), 'Service worker cache does not match version constant');
check('sw_no_old_cache', !/phase2b|phase2a|phase15/.test(sw), 'Service worker contains stale pre-Phase-2 cache identifiers');
check('manifest_json', (() => { try { const m = JSON.parse(read('manifest.webmanifest')); return !!m.name && !!m.start_url && !!m.display; } catch { return false; } })(), 'Manifest is missing required install metadata');
check('netlify_config', fs.existsSync(path.join(ROOT, 'netlify.toml')), 'netlify.toml missing');

// ---------- Package/reproducibility ----------
let pkg = null;
try { pkg = JSON.parse(read('package.json')); } catch (e) { fail('package_json', `package.json invalid: ${e.message}`); }
if (pkg) {
  check('package_phase15', pkg.scripts?.['phase15:gate'] === 'node tools/phase15-gate.mjs', 'Phase 1.5 gate command missing');
  check('package_phase2c', pkg.scripts?.['phase2c:brain-audit'] === 'node tools/phase2c-brain-audit.mjs', 'Phase 2C audit command missing');
  check('package_phase2d', pkg.scripts?.['phase2d:brain-adversarial'] === 'node tools/phase2d-brain-adversarial.mjs', 'Phase 2D audit command missing');
  check('package_phase2e', pkg.scripts?.['phase2e:regression'] === 'node tools/phase2e-full-regression.mjs', 'Phase 2E regression command missing');
}

// ---------- Storage + backup simulation ----------
try {
  const store = new Map();
  const localStorage = {
    getItem: k => store.has(k) ? store.get(k) : null,
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: k => store.delete(k),
    clear: () => store.clear(),
  };
  const ctx = {
    window: {}, localStorage, console, Math, Date, JSON, Set, Map, Object, Array, Number, String, Boolean, Error, RegExp,
    parseInt, parseFloat,
    performance: { now: () => 0 },
  };
  vm.createContext(ctx);
  vm.runInContext(read('js/data.js'), ctx, { filename: 'js/data.js' });
  vm.runInContext(read('js/utils.js'), ctx, { filename: 'js/utils.js' });
  vm.runInContext(read('js/storage.js'), ctx, { filename: 'js/storage.js' });
  vm.runInContext('this.__Storage = Storage;', ctx);
  const Storage = ctx.__Storage;
  const defaultStats = Storage.defaultStats();
  check('storage_schema_5', Storage.SCHEMA_VERSION === 5, `Storage schema is ${Storage.SCHEMA_VERSION}`);
  check('storage_default_brain_stats', Number(defaultStats.brainBestScore) === 0 && Number(defaultStats.brainCount) === 0, 'Default Brain stats missing/invalid');
  Storage.setPredictions([{ id: 'p1', mode: 'prediction' }]);
  Storage.setBrainRuns([{ runId: 'b1', dimensions: { Accuracy: 80 } }]);
  check('storage_prediction_roundtrip', Array.isArray(Storage.getPredictions()) && Storage.getPredictions().length === 1, 'Prediction storage roundtrip failed');
  check('storage_brain_roundtrip', Array.isArray(Storage.getBrainRuns()) && Storage.getBrainRuns().length === 1, 'Brain run storage roundtrip failed');
  Storage.setBrainRuns(Array.from({ length: 125 }, (_, i) => ({ runId: String(i) })));
  check('storage_brain_cap', Storage.getBrainRuns().length === 100, 'Brain run history is not capped at 100');
  report.storageSimulation = { schema: Storage.SCHEMA_VERSION, predictionCount: Storage.getPredictions().length, brainRunCount: Storage.getBrainRuns().length };
} catch (e) {
  fail('storage_simulation', `Storage simulation failed: ${e.message}`);
}

try {
  const localStorage = { getItem(){return null;}, setItem(){}, removeItem(){}, clear(){} };
  const ctx = {
    window: {}, localStorage, console, Math, Date, JSON, Set, Map, Object, Array, Number, String, Boolean, Error, RegExp,
    parseInt, parseFloat, Blob: class {}, URL: { createObjectURL(){return 'blob:';}, revokeObjectURL(){} },
    document: { createElement(){ return { click(){}, style:{}, appendChild(){}, removeChild(){}, addEventListener(){}}; }, body:{ appendChild(){}, removeChild(){} } },
  };
  vm.createContext(ctx);
  vm.runInContext(read('js/data.js'), ctx, { filename: 'js/data.js' });
  vm.runInContext(read('js/utils.js'), ctx, { filename: 'js/utils.js' });
  vm.runInContext(read('js/storage.js'), ctx, { filename: 'js/storage.js' });
  vm.runInContext(read('js/backup.js'), ctx, { filename: 'js/backup.js' });
  vm.runInContext('this.__Backup = Backup;', ctx);
  const Backup = ctx.__Backup;
  check('backup_validator_accepts_valid', Backup.validate({ app: 'BETWEEN', data: { history: [] } }).valid === true, 'Valid backup rejected');
  check('backup_validator_rejects_array_object', Backup.validate({ app: 'BETWEEN', data: [] }).valid === false, 'Malformed backup object accepted');
  check('backup_validator_rejects_bad_array', Backup.validate({ app: 'BETWEEN', data: { history: {} } }).valid === false, 'Malformed history accepted');
  check('backup_validator_rejects_wrong_app', Backup.validate({ app: 'OTHER', data: {} }).valid === false, 'Wrong-app backup accepted');
  const result = Backup.validate({ app: 'BETWEEN', data: { brainRuns: [{ runId: '<x>' }] } });
  check('backup_brain_section_validated', result.valid === true, 'Brain run backup section unexpectedly rejected');
} catch (e) {
  fail('backup_simulation', `Backup simulation failed: ${e.message}`);
}

// ---------- Content-specific feature wiring ----------
const code = {
  app: read('js/app.js'), engine: read('js/engine.js'), modes: read('js/modes.js'), screens: read('js/screens.js'), predictions: read('js/predictions.js'),
  backup: read('js/backup.js'), storage: read('js/storage.js'), brainEngine: read('js/brain/engine.js'), brainRenderer: read('js/brain/renderer.js'), brainRun: read('js/brain/run.js'), brainConfig: read('js/brain/config.js'),
};
check('knowledge_explanations', code.modes.includes('item.explanation') || code.modes.includes('explanation'), 'Knowledge explanation rendering not wired');
check('scenario_title', code.modes.includes('item.title'), 'Scenario title rendering not wired');
check('estimation_range_ui', read('js/scoring.js').includes('target_kind') && read('js/scoring.js').includes('target_min') && code.modes.includes('estimationAccuracyForItem'), 'Estimation range handling not wired');
check('prediction_numeric_ui', code.modes.includes('prediction_shape') && code.modes.includes('predictionValue'), 'Prediction numeric UI not wired');
check('prediction_ledger', code.predictions.includes('const Predictions =') && code.predictions.includes('Storage.updatePredictions'), 'Prediction ledger is missing');
check('brain_stats_storage', code.storage.includes('brainRuns') && code.app.includes('handleBrainRun'), 'Brain stats/storage integration missing');
check('daily_brain', code.engine.includes("dailyPick('brain', 'brain')") && code.screens.includes('Daily Brain'), 'Daily Brain not wired');
check('backup_brain_runs', code.backup.includes('brainRuns') && code.backup.includes('cleanBrainRuns'), 'Brain backup support missing');
check('brain_run_cleanup', code.brainRun.includes('cancel()') && code.brainRenderer.includes('stageGuard'), 'Brain timer/stage cleanup protections missing');
check('brain_familiarity_progression', code.brainRun.includes('progressionForRun') && code.brainRun.includes('run.progression') && code.brainRun.includes('challenge.timeLimit = null'), 'Brain familiarity progression/onboarding timing policy missing');
check('brain_progression_audit_script', fs.existsSync(path.join(ROOT,'tools/brain-progression-audit.mjs')) && JSON.parse(fs.readFileSync(path.join(ROOT,'docs/BRAIN_PROGRESSION_AUDIT.json'),'utf8')).result === 'PASS', 'Brain progression audit is missing or not passing');

const rendererModes = ['pick_one','knowledge','scenario','majority','estimation','prediction','random','brain'];
const rendererTableMatch = code.modes.match(/const\s+RENDERERS\s*=\s*Object\.freeze\(\{([\s\S]*?)\}\);/);
check('modes_renderer_dispatch', !!rendererTableMatch && rendererModes.every(mode => new RegExp('\\b' + mode + '\\s*:\\s*render[A-Za-z0-9_]+').test(rendererTableMatch[1])), 'Modes renderer dispatch table is missing or incomplete');

// ---------- Security / dynamic HTML review ----------
const allRuntimeCode = ['js/app.js','js/screens.js','js/modes.js','js/packs.js','js/share.js','js/brain/renderer.js','js/backup.js'].map(read).join('\n');
const dangerousDynamicExpressions = [
  /innerHTML\s*=\s*[^;\n]*\$\{(?:p\.title|pack\.title|item\.prompt|item\.title|entry\.prompt|x\.prompt)/,
  /innerHTML\s*=\s*[^;\n]*\$\{(?:p\.description|item\.options|p\.id|item\.id)/,
];
report.security.innerHtmlDynamicSinkCount = (allRuntimeCode.match(/\.innerHTML\s*=/g) || []).length;
check('dynamic_html_known_sinks_escaped', !dangerousDynamicExpressions.some(r => r.test(allRuntimeCode)), 'Found a known user/content field interpolated directly into innerHTML');
check('no_eval', !/\beval\s*\(|\bnew Function\s*\(/.test(allRuntimeCode), 'eval/new Function found in runtime code');
check('url_params_are_parsed', code.app.includes('new URLSearchParams(location.search)'), 'URL parameter parsing missing');
check('pack_token_validated', code.app.includes('Packs.decode(packToken)') && read('js/packs.js').includes('function decode(token)'), 'Pack URL token is not decoded through the pack validator');
check('pack_ids_escaped', code.screens.includes('Utils.escapeHtml(p.id)'), 'Pack IDs not escaped in data attributes');
check('prediction_ids_escaped', code.screens.includes('Utils.escapeHtml(p.id)'), 'Prediction IDs not escaped in data attributes');
check('brain_text_escaped', code.brainRenderer.includes('function esc') || code.brainRenderer.includes('Utils.escapeHtml'), 'Brain renderer has no explicit text escaping helper');

// ---------- Accessibility / interaction sanity ----------
check('reduced_motion_timing_separate', read('js/brain/renderer.js').includes('reducedMotion') === false || !read('js/brain/renderer.js').includes('timeLimit * 0.'), 'Reduced Motion appears to alter Brain timing');
const cssRefs=[...index.matchAll(/<link\s+[^>]*rel=[\"']stylesheet[\"'][^>]*href=[\"']([^\"']+)[\"'][^>]*>/g)].map(m=>m[1]);
check('stylesheet_refs_exist', cssRefs.length>0 && cssRefs.every(h=>fs.existsSync(path.join(ROOT,h))), 'Stylesheet reference missing');
const cssText=cssRefs.map(h=>read(h)).join('\n');
check('large_touch_controls_class', /\.option-card|\.btn/.test(cssText), 'Expected touch control CSS could not be located');
check('safe_exit_control', code.app.includes('exitExperience') && code.screens.includes('btn-back'), 'Safe exit/back control wiring missing');

// ---------- Release documents ----------
const checklist = read('docs/PHASE4_REAL_WORLD_TEST_CHECKLIST.md');
check('tester_checklist_complete', checklist.length > 7000, 'Tester checklist is unexpectedly small');
check('tester_names_all_brain', ['Code Breaker','Memory Grid','Sequence','Reverse','Rule Switch','Don’t Tap','Odd One','Change Detective','Flash Recall','Where Was It?','Path','Sort It','Number Trap','BETWEEN Code','Mirror','The Next Thing','Rapid Sort','Memory + Distraction','One Second','FINAL BOSS: BETWEEN'].every(x => checklist.includes(x)), 'Tester checklist is missing a Brain experience');
check('phase15_record', fs.existsSync(path.join(ROOT, 'docs/PHASE1_5_ENGINEERING_GATE.md')), 'Phase 1.5 engineering gate record missing');
check('phase2e_record', fs.existsSync(path.join(ROOT, 'docs/PHASE2E_FULL_REGRESSION.json')), 'Phase 2E regression record missing');

// ---------- Re-run the current automated gates ----------
for (const [name, script] of [['phase2c_repeat','tools/phase2c-brain-audit.mjs'],['phase2d_repeat','tools/phase2d-brain-adversarial.mjs'],['phase2e_repeat','tools/phase2e-full-regression.mjs']]) {
  if (script.endsWith('phase2e-full-regression.mjs')) {
    // Do not recursively invoke the current Phase 3 audit; this is the Phase 2E gate only.
  }
  try { execFileSync(process.execPath, [script], { stdio: 'pipe' }); pass(name); }
  catch (e) { fail(name, `${script} failed on the repeat pass`); report.notes.push(String(e.stdout || e.stderr || e.message)); }
}

// The repeated 2E pass above is intentionally one of the release checks. Browser/device behavior remains Phase 4 and is not claimed here.
report.notes.push('Phase 4 physical-device/browser/PWA testing is intentionally deferred to the user/testers; this audit only verifies machine-checkable release properties.');
fs.writeFileSync(path.join(ROOT,'docs/PHASE3_FINAL_ENGINEERING_AUDIT.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
if (report.result === 'FAIL') process.exit(1);

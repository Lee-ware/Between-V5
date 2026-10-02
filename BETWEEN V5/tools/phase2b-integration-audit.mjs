import fs from 'fs';
import crypto from 'crypto';
import vm from 'vm';

const root = new URL('..', import.meta.url).pathname;
const read = f => fs.readFileSync(new URL(f, import.meta.url), 'utf8');
const dataText = read('../js/data.js');
const sourceText = read('../content-sources/BETWEEN-non-brain-content.txt');
const sourceHash = crypto.createHash('sha256').update(sourceText).digest('hex');

const ctx = { window: {}, console, Date, Math, Intl, Set, Map, Number, String, Array, Object, JSON, RegExp };
vm.createContext(ctx);
vm.runInContext(dataText, ctx);
const data = ctx.window.BETWEEN_DATA;

const issues = [];
const notes = [];
const check = (ok, msg) => { if (!ok) issues.push(msg); };
const modes = ['pick_one','knowledge','scenario','estimation','prediction','random'];
const expected = {pick_one:150, knowledge:99, scenario:75, estimation:100, prediction:100, random:100};
const actual = Object.fromEntries(modes.map(m => [m, data.items.filter(i => i.mode === m).length]));

for (const m of modes) check(actual[m] === expected[m], `${m}: expected ${expected[m]}, found ${actual[m]}`);
check(data.items.length === 784, `intermediate item count expected 784 (624 normal + 100 archive + 60 temporary Brain), found ${data.items.length}`);
check(data.version === '3.1', `content version expected 3.1, found ${data.version}`);
check(data.audit?.source_sha256 === sourceHash, 'source SHA does not match packaged non-Brain source copy');
check(data.content_rules?.normal_content_is_complete_replacement === true, 'replacement rule missing');
check(data.content_rules?.prediction_resolution_ledger === true, 'prediction ledger rule missing');
check(data.content_rules?.estimation_ranges_preserved === true, 'estimation range rule missing');

const ids = new Set();
const sigs = new Set();
for (const item of data.items) {
  check(item.id && item.mode && item.category && item.prompt, `missing core field on ${item.id || '(unknown)'}`);
  check(!ids.has(item.id), `duplicate id ${item.id}`); ids.add(item.id);
  const sig = JSON.stringify([item.mode,item.prompt,item.options||[],item.answer_index??null,item.answer??null]);
  check(!sigs.has(sig), `duplicate content signature ${item.id}`); sigs.add(sig);
}

const ks = data.items.filter(i => i.mode === 'knowledge');
check(ks.every(i => Array.isArray(i.options) && i.options.length === 4 && Number.isInteger(i.answer_index) && i.options[i.answer_index] === i.answer), 'Knowledge MCQ integrity failed');
check(ks.every(i => typeof i.explanation === 'string' && i.explanation.trim()), 'Knowledge explanation missing on one or more records');

const ss = data.items.filter(i => i.mode === 'scenario');
check(ss.every(i => typeof i.title === 'string' && i.title.trim()), 'Scenario title missing');
check(ss.every(i => Array.isArray(i.options) && i.options.length >= 2), 'Scenario options malformed');

const es = data.items.filter(i => i.mode === 'estimation');
const eKinds = es.reduce((a,i)=>(a[i.target_kind]=(a[i.target_kind]||0)+1,a),{});
check(eKinds.range === 17 && eKinds.exact === 71 && eKinds.lower_bound === 3 && eKinds.text === 9, `Estimation source kinds drifted: ${JSON.stringify(eKinds)}`);
check(es.filter(i=>i.target_kind==='range').every(i=>Number.isFinite(i.target_min)&&Number.isFinite(i.target_max)&&i.answer_display), 'Estimation range record malformed');
check(es.filter(i=>i.target_kind==='text').every(i=>typeof i.answer_display==='string'&&i.answer_display.trim()), 'Text estimation answer missing');

const ps = data.items.filter(i => i.mode === 'prediction');
const pShapes = ps.reduce((a,i)=>(a[i.prediction_shape]=(a[i.prediction_shape]||0)+1,a),{});
check(ps.length === 100 && pShapes.binary === 81 && pShapes.numeric === 10 && pShapes.list === 9, `Prediction shapes drifted: ${JSON.stringify(pShapes)}`);
check(ps.every(i => i.resolution_condition === i.prompt), 'Prediction resolution condition drifted from source prompt');
check(ps.filter(i=>i.prediction_shape==='numeric').every(i=>/\bhow many\b|\bhow long\b|\bhow much\b/i.test(i.prompt)), 'Numeric prediction shape used on a non-quantity prompt');
check(ps.filter(i=>i.resolution_window).length === 54, `Expected 54 predictions with explicit source resolution windows, found ${ps.filter(i=>i.resolution_window).length}`);
notes.push(`${ps.filter(i=>!i.resolution_window).length} prediction records intentionally have no explicit source window; no dates were invented.`);

const rs = data.items.filter(i => i.mode === 'random');
const rShapes = rs.reduce((a,i)=>(a[i.random_shape]=(a[i.random_shape]||0)+1,a),{});
check(rs.length === 100 && Object.keys(rShapes).length >= 2, `Random shapes look unexpectedly uniform: ${JSON.stringify(rShapes)}`);
check(rs.every(i=>['binary','yesno','list','freetext','open','reflection'].includes(i.random_shape)), 'Unsupported Random shape found');

check(fs.existsSync(new URL('../js/predictions.js', import.meta.url)), 'predictions.js missing');
const index = read('../index.html');
const sw = read('../service-worker.js');
const version = read('../js/version.js');
const storage = read('../js/storage.js');
const backup = read('../js/backup.js');
const modesJs = read('../js/modes.js');
const screens = read('../js/screens.js');
const app = read('../js/app.js');
check(index.includes('js/predictions.js'), 'index.html does not load predictions.js');
check(sw.includes('js/predictions.js') && sw.includes('phase2b'), 'service worker does not cache Phase 2B prediction layer');
check(version.includes("storage: 4") && version.includes('phase2b'), 'version constants not bumped for Phase 2B');
check(storage.includes('SCHEMA_VERSION = 4') && storage.includes('4: () =>') && storage.includes('getPredictions') && storage.includes('updatePredictions'), 'storage schema/prediction migration incomplete');
check(backup.includes("'predictions'") && backup.includes('cleanPredictions') && backup.includes('Storage.setPredictions'), 'backup prediction support incomplete');
check(modesJs.includes('item.explanation') && modesJs.includes('item.title') && modesJs.includes('estimationAccuracyForItem') && modesJs.includes("shape === 'numeric'"), 'mode renderers do not contain Phase 2B integration paths');
check(app.includes("case 'predictions'") && app.includes('Predictions.save(item, result)'), 'app prediction screen/save integration missing');
check(screens.includes('function predictions(root)') && screens.includes('predictionSummaryTitle'), 'prediction screen missing');

// VM behavior check for the local prediction ledger.
const store = new Map();
const behavior = { console, Date, Math, Intl, Set, Map, Number, String, Array, Object, JSON, RegExp };
behavior.window = { BETWEEN_DATA: data, matchMedia: () => ({matches:false}) };
behavior.localStorage = {
  getItem: k => store.has(k) ? store.get(k) : null,
  setItem: (k,v) => store.set(k,String(v)),
  removeItem: k => store.delete(k),
};
behavior.navigator = {};
vm.createContext(behavior);
vm.runInContext(read('../js/utils.js'), behavior);
vm.runInContext(storage, behavior);
vm.runInContext(read('../js/predictions.js'), behavior);
const behaviorProbe = vm.runInContext(`(() => {
  const numericItem = window.BETWEEN_DATA.items.find(i => i.id === 'v5-prediction-041');
  const saved = Predictions.save(numericItem, { predictionValue: 7 });
  const saveOk = !!saved && saved.shape === 'numeric' && saved.predictedValue === 7 && Storage.getPredictions().length === 1;
  const waitingOk = Predictions.status(saved) === 'waiting';
  Storage.updatePredictions(arr => { arr[0].eligibleAt = Date.now() - 1; });
  const resolved = Predictions.resolve(saved.id, 6);
  const resolveOk = !!resolved && resolved.status === 'resolved' && resolved.outcome === 'miss' && resolved.actualValue === 6;
  const listItem = window.BETWEEN_DATA.items.find(i => i.id === 'v5-prediction-091') || window.BETWEEN_DATA.items.find(i => i.mode === 'prediction' && i.prediction_shape === 'list');
  const listEntry = Predictions.save(listItem, { chosenText: listItem.options[0] });
  const listSaveOk = !!listEntry && listEntry.predictedDisplay === listItem.options[0] && Predictions.status(listEntry) === 'ready';
  const listResolved = Predictions.resolve(listEntry.id, listItem.options[0]);
  const listResolveOk = !!listResolved && listResolved.outcome === 'hit';
  return {saveOk,waitingOk,resolveOk,listSaveOk,listResolveOk,historyLength:JSON.parse(localStorage.getItem('between:v1:history') || '[]').length};
})()`, behavior);
check(behaviorProbe.saveOk, 'numeric prediction failed to save');
check(behaviorProbe.waitingOk, 'future-window prediction did not enter waiting state');
check(behaviorProbe.resolveOk, 'numeric prediction resolve/miss failed');
check(behaviorProbe.listSaveOk, 'list prediction save/ready failed');
check(behaviorProbe.listResolveOk, 'list prediction exact-hit resolution failed');
check(behaviorProbe.historyLength === 0, 'prediction ledger should not write gameplay history directly');

const audit = {
  phase: '2B',
  result: issues.length ? 'FAIL' : 'PASS_WITH_NOTES',
  counts: actual,
  intermediate_total: data.items.length,
  prediction_shapes: pShapes,
  estimation_kinds: eKinds,
  random_shapes: rShapes,
  source_sha256: sourceHash,
  notes,
  issues,
};
fs.writeFileSync(new URL('../docs/PHASE2B_INTEGRATION_AUDIT.json', import.meta.url), JSON.stringify(audit,null,2)+'\n');
console.log(JSON.stringify(audit,null,2));
process.exitCode = issues.length ? 1 : 0;

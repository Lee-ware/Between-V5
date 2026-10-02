import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';

const root = path.resolve(new URL('.', import.meta.url).pathname, '..');
const dataSrc = fs.readFileSync(path.join(root,'js','data.js'),'utf8');
const ctx = { window: {} };
vm.createContext(ctx); vm.runInContext(dataSrc, ctx, { filename:'js/data.js' });
const data = ctx.window.BETWEEN_DATA;
const targets = JSON.parse(fs.readFileSync(path.join(root,'tools','phase15-targets.json'),'utf8'));
const manifest = JSON.parse(fs.readFileSync(path.join(root,'tools','phase15-old-normal-manifest.json'),'utf8'));
const sourcePath = path.join(root,'content-sources','BETWEEN-non-brain-content.txt');
const brainSourcePath = path.join(root,'content-sources','BETWEEN-Brain-content.txt');

const expected = targets.phase2.normalModeFinalCounts;
const normalModes = ['pick_one','knowledge','scenario','estimation','prediction','random'];
const issues = [];
const notes = [];
const count = mode => data.items.filter(i => i.mode === mode).length;

for (const mode of normalModes) if (count(mode) !== expected[mode]) issues.push(`${mode}: ${count(mode)} != ${expected[mode]}`);
if (count('majority') !== targets.phase2.archivedMajoritySourceCount) issues.push(`majority: ${count('majority')} != ${targets.phase2.archivedMajoritySourceCount}`);
if (count('brain') !== targets.phase1Baseline.modeCounts.brain) issues.push(`temporary brain count changed during 2A: ${count('brain')}`);

const idSet = new Set();
const sigSet = new Set();
for (const i of data.items) {
  if (idSet.has(i.id)) issues.push(`duplicate id: ${i.id}`); idSet.add(i.id);
  const sig = JSON.stringify({mode:i.mode,prompt:i.prompt,options:Array.isArray(i.options)?i.options:[],answer_index:i.answer_index ?? null,answer:i.answer ?? null});
  if (sigSet.has(sig)) issues.push(`duplicate exact content: ${i.mode}:${i.prompt}`); sigSet.add(sig);
}

const oldIdSet = new Set(manifest.items.map(x=>x.id));
const currentNormal = data.items.filter(i => normalModes.includes(i.mode));
for (const i of currentNormal) {
  if (oldIdSet.has(i.id)) issues.push(`old Phase-1 normal id survived: ${i.id}`);
  const sig = JSON.stringify({mode:i.mode,prompt:i.prompt,options:Array.isArray(i.options)?i.options:[],answer_index:i.answer_index ?? null,answer:i.answer ?? null});
  const h = crypto.createHash('sha256').update(sig).digest('hex');
  if (manifest.items.some(x=>x.prompt_sha256===h)) issues.push(`old Phase-1 normal content signature survived: ${i.id}`);
}

const knowledge = data.items.filter(i=>i.mode==='knowledge');
if (knowledge.some(i=>i.id === 'v5-knowledge-025')) issues.push('Knowledge #25 was not removed');
for (const i of knowledge) {
  if (!Array.isArray(i.options) || i.options.length !== 4) issues.push(`${i.id}: expected 4 knowledge options`);
  if (i.options?.[i.answer_index] !== i.answer) issues.push(`${i.id}: answer index mismatch`);
  if (!i.explanation?.trim()) issues.push(`${i.id}: missing explanation`);
}

for (const i of data.items.filter(i=>i.mode==='pick_one')) if (!Array.isArray(i.options) || i.options.length!==2) issues.push(`${i.id}: Pick One must have 2 options`);
for (const i of data.items.filter(i=>i.mode==='scenario')) if (!Array.isArray(i.options) || i.options.length<2) issues.push(`${i.id}: Scenario must have at least 2 options`);
for (const i of data.items.filter(i=>i.mode==='majority')) if (!Array.isArray(i.options) || i.options.length<2) issues.push(`${i.id}: Majority archive needs at least 2 options`);
for (const i of data.items.filter(i=>i.mode==='estimation')) if (!i.answer_display?.trim() || !i.estimate_kind) issues.push(`${i.id}: missing estimation answer data`);
for (const i of data.items.filter(i=>i.mode==='prediction')) {
  if (!['binary','list','open'].includes(i.prediction_shape)) issues.push(`${i.id}: invalid prediction shape ${i.prediction_shape}`);
  if (!i.resolution_condition?.trim()) issues.push(`${i.id}: missing prediction resolution condition`);
}
for (const i of data.items.filter(i=>i.mode==='random')) if (!['binary','list','open'].includes(i.random_shape)) issues.push(`${i.id}: invalid random shape ${i.random_shape}`);

const expectedNonBrainHash = targets.sourceFiles.nonBrain.sha256;
const actualNonBrainHash = crypto.createHash('sha256').update(fs.readFileSync(sourcePath)).digest('hex');
if (actualNonBrainHash !== expectedNonBrainHash) issues.push(`non-brain source hash mismatch: ${actualNonBrainHash}`);
const expectedBrainHash = targets.sourceFiles.brain.sha256;
const actualBrainHash = crypto.createHash('sha256').update(fs.readFileSync(brainSourcePath)).digest('hex');
if (actualBrainHash !== expectedBrainHash) issues.push(`brain source hash mismatch: ${actualBrainHash}`);
if (data.audit?.source_sha256 !== expectedNonBrainHash) issues.push('data.js source hash metadata mismatch');

const missingResolutionWindows = data.items.filter(i=>i.mode==='prediction' && !i.resolution_window).length;
const numericPredictions = data.items.filter(i=>i.mode==='prediction' && i.prompt.toLowerCase().startsWith('how many')).length;
if (missingResolutionWindows) notes.push(`${missingResolutionWindows} prediction records do not have an explicit resolution_window in the source wording; preserve as a Phase 2B integration/content decision rather than inventing dates.`);
if (numericPredictions) notes.push(`${numericPredictions} prediction records are numeric/open-ended prompts and need a numeric prediction UI in Phase 2B.`);
const textEst = data.items.filter(i=>i.mode==='estimation' && i.estimate_kind==='text').length;
if (textEst) notes.push(`${textEst} estimation records have source answers without a numeric anchor; the source answer text is preserved instead of inventing a number.`);

const report = {
  phase:'2A',
  result: issues.length ? 'BLOCKED' : 'PASS_WITH_NOTES',
  counts:{...Object.fromEntries([...normalModes,'majority','brain'].map(m=>[m,count(m)])), total:data.items.length},
  expected:{...expected, majority:targets.phase2.archivedMajoritySourceCount, temporary_brain:targets.phase1Baseline.modeCounts.brain},
  knowledge_removed:[25],
  replacement_verified: issues.filter(x=>x.includes('old Phase-1')).length===0,
  issues,
  notes,
};
fs.writeFileSync(path.join(root,'docs','PHASE2A_CONTENT_AUDIT.json'), JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
process.exit(issues.length ? 1 : 0);

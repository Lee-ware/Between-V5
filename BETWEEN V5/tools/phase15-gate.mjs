#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';

const ROOT = path.resolve(new URL('..', import.meta.url).pathname);
const TARGETS = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'phase15-targets.json'), 'utf8'));
const SOURCE_DIR = process.env.BETWEEN_CONTENT_SOURCE_DIR ? path.resolve(process.env.BETWEEN_CONTENT_SOURCE_DIR) : path.resolve(ROOT, '..');
const report = {
  gate: TARGETS.gate,
  generatedAt: new Date().toISOString(),
  root: ROOT,
  sourceDir: SOURCE_DIR,
  statuses: [],
  sourceContent: {},
  baseline: {},
  static: {},
  data: {},
  behavior: {},
  security: {},
  summary: { pass: 0, warn: 0, fail: 0 },
};

function status(name, state, detail = '') {
  report.statuses.push({ name, state, detail });
  report.summary[state] += 1;
}
function assertPass(name, condition, detail = '') {
  status(name, condition ? 'pass' : 'fail', detail);
}
function warn(name, detail) { status(name, 'warn', detail); }
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function sha256(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}
function relExists(rel) {
  const clean = rel.replace(/^\.\//, '');
  return fs.existsSync(path.join(ROOT, clean));
}
function sameJsonObject(a, b) {
  return JSON.stringify(Object.fromEntries(Object.entries(a || {}).sort(([ka],[kb]) => ka.localeCompare(kb)))) === JSON.stringify(Object.fromEntries(Object.entries(b || {}).sort(([ka],[kb]) => ka.localeCompare(kb))));
}

function parseJson(text, label) {
  try { return JSON.parse(text); }
  catch (e) { status(label, 'fail', `JSON parse error: ${e.message}`); return null; }
}

// ---------- Source-of-truth count gate ----------
function sectionBetween(text, start, end) {
  const a = text.indexOf(start);
  if (a < 0) return '';
  const b = end ? text.indexOf(end, a + start.length) : text.length;
  return text.slice(a, b < 0 ? text.length : b);
}
function numberMarkers(block, regex) {
  return [...block.matchAll(regex)].map(m => Number(m[1]));
}
function validateSequential(name, nums, expectedRaw) {
  const expected = Array.from({ length: expectedRaw }, (_, i) => i + 1);
  const ok = nums.length === expected.length && nums.every((n, i) => n === expected[i]);
  assertPass(`source:${name}:sequential-numbering`, ok, ok ? `${nums.length} numbered entries` : `found ${nums.length}; expected 1..${expectedRaw}`);
}

const nonBrainPath = path.join(SOURCE_DIR, 'BETWEEN-non-brain-content.txt');
const brainPath = path.join(SOURCE_DIR, 'BETWEEN-Brain-content.txt');
if (fs.existsSync(nonBrainPath)) {
  const s = fs.readFileSync(nonBrainPath, 'utf8');
  const sections = {
    pick_one: s.slice(0, s.indexOf('\n# BETWEEN — KNOWLEDGE')),
    knowledge: sectionBetween(s, '# BETWEEN — KNOWLEDGE', '# BETWEEN — SCENARIO'),
    scenario: sectionBetween(s, '# BETWEEN — SCENARIO', '# MAJORITY'),
    majority: sectionBetween(s, '# MAJORITY', '# ESTIMATION'),
    estimation: sectionBetween(s, '# ESTIMATION', '# PREDICTION'),
    prediction: sectionBetween(s, '# PREDICTION', '\nRANDOM'),
    random: sectionBetween(s, '\nRANDOM', null),
  };
  const markers = {
    pick_one: numberMarkers(sections.pick_one, /^\s*(\d+)\.\s+Would you rather\b/gm),
    knowledge: numberMarkers(sections.knowledge, /^\s*\*\*(\d+)\.\s/gm),
    scenario: numberMarkers(sections.scenario, /^###\s+(\d+)\.\s/gm),
    majority: numberMarkers(sections.majority, /^\s*\*\*(\d+)\.\*\*\s/gm),
    estimation: numberMarkers(sections.estimation, /^\s*\*\*(\d+)\.\*\*\s/gm),
    prediction: numberMarkers(sections.prediction, /^\s*\*\*(\d+)\.\*\*\s/gm),
    random: numberMarkers(sections.random, /^\s*(\d+)\.\s/gm),
  };
  const removes = [];
  for (const m of sections.knowledge.matchAll(/^\s*\*\*Verdict:\s*REMOVE\b.*$/gmi)) {
    const prefix = sections.knowledge.slice(0, m.index);
    const markersBefore = [...prefix.matchAll(/^\s*\*\*(\d+)\.\s/gm)];
    if (markersBefore.length) removes.push(Number(markersBefore.at(-1)[1]));
  }
  const expected = TARGETS.phase2.normalModeFinalCounts;
  for (const [mode, nums] of Object.entries(markers)) {
    if (mode === 'majority') validateSequential(`majority`, nums, 100);
    else validateSequential(mode, nums, mode === 'pick_one' ? 150 : mode === 'knowledge' ? 100 : expected[mode]);
  }
  assertPass('source:knowledge:explicit-removals', removes.length === 1 && removes[0] === 25, `marked REMOVE: ${JSON.stringify(removes)}`);
  const effective = Object.fromEntries(Object.entries(markers).map(([mode, nums]) => [mode, nums.length - (mode === 'knowledge' ? removes.length : 0)]));
  report.sourceContent.nonBrain = {
    sha256: sha256(nonBrainPath),
    rawCounts: Object.fromEntries(Object.entries(markers).map(([k, v]) => [k, v.length])),
    exclusions: { knowledge: removes },
    effectiveCounts: effective,
    expectedFinalCounts: expected,
    finalNormalTotal: Object.values(expected).reduce((a, b) => a + b, 0),
  };
  assertPass('source:non-brain:sha256', report.sourceContent.nonBrain.sha256 === TARGETS.sourceFiles.nonBrain.sha256, `sha256=${report.sourceContent.nonBrain.sha256}`);
  assertPass('source:normal:counts', Object.entries(expected).every(([m, n]) => effective[m] === n), `effective=${JSON.stringify(effective)}`);
  assertPass('source:archived-majority:count', effective.majority === TARGETS.phase2.archivedMajoritySourceCount, `majority source=${effective.majority}`);
} else {
  warn('source:non-brain:available', `not found at ${nonBrainPath}; target counts remain locked in phase15-targets.json`);
}

if (fs.existsSync(brainPath)) {
  const s = fs.readFileSync(brainPath, 'utf8');
  const nums = numberMarkers(s, /^BRAIN\s+(\d{2})\s+—/gm);
  const expected = TARGETS.phase2.brainPlayerFacingExperiences;
  validateSequential('brain-experiences', nums, expected);
  report.sourceContent.brain = { sha256: sha256(brainPath), experiences: nums.length, expected };
  assertPass('source:brain:sha256', report.sourceContent.brain.sha256 === TARGETS.sourceFiles.brain.sha256, `sha256=${report.sourceContent.brain.sha256}`);
  assertPass('source:brain:experience-count', nums.length === expected, `${nums.length} player-facing experiences`);
} else {
  warn('source:brain:available', `not found at ${brainPath}; target count remains locked in phase15-targets.json`);
}

// ---------- Baseline / packaging gate ----------
const versionText = read('js/version.js');
const appVersion = versionText.match(/app:\s*'([^']+)'/)?.[1] || null;
const contentVersion = versionText.match(/content:\s*\(window\.BETWEEN_DATA.*?\|\|\s*'([^']+)'\)/)?.[1] || null;
assertPass('baseline:app-version', appVersion === TARGETS.phase1Baseline.appVersion, `app=${appVersion}`);
const dataFile = path.join(ROOT, 'js', 'data.js');
assertPass('baseline:data-file-present', fs.existsSync(dataFile));
const dataHash = sha256(dataFile);
report.baseline = { appVersion, dataHash };

// Parse the embedded data object without executing the rest of the app.
let DATA = null;
try {
  const s = fs.readFileSync(dataFile, 'utf8').trim();
  const prefix = 'window.BETWEEN_DATA = ';
  if (!s.startsWith(prefix)) throw new Error('unexpected data.js wrapper');
  DATA = JSON.parse(s.slice(prefix.length).replace(/;$/, ''));
  assertPass('data:json-parse', true, `version=${DATA.version} total=${DATA.items.length}`);
} catch (e) {
  status('data:json-parse', 'fail', e.message);
}

if (DATA) {
  const items = Array.isArray(DATA.items) ? DATA.items : [];
  const allowed = new Set(['pick_one','knowledge','scenario','estimation','prediction','random','brain','majority']);
  const required = ['id','mode','category','prompt'];
  const ids = new Map(), prompts = new Map();
  const missing = [], modeIssues = [], badModes = [];
  for (const item of items) {
    if (!item || typeof item !== 'object') { modeIssues.push('non-object item'); continue; }
    for (const f of required) if (item[f] === undefined || item[f] === null || item[f] === '') missing.push(`${item.id || '?'}:${f}`);
    if (!allowed.has(item.mode)) badModes.push(item.id);
    ids.set(item.id, (ids.get(item.id) || 0) + 1);
    prompts.set(item.prompt, (prompts.get(item.prompt) || 0) + 1);
    if ((item.mode === 'pick_one' || item.mode === 'majority') && (!Array.isArray(item.options) || item.options.length !== 2)) modeIssues.push(`${item.id}:options`);
    if (item.mode === 'knowledge') {
      if (!Array.isArray(item.options) || item.options.length !== 4) modeIssues.push(`${item.id}:knowledge options`);
      if (!Number.isInteger(item.answer_index)) modeIssues.push(`${item.id}:answer_index`);
      if (Array.isArray(item.options) && item.options.length === 4 && new Set(item.options).size !== 4) modeIssues.push(`${item.id}:duplicate options`);
      if (Array.isArray(item.options) && item.options[item.answer_index] !== item.answer) modeIssues.push(`${item.id}:answer mismatch`);
    }
    if (item.mode === 'scenario' && (!Array.isArray(item.options) || item.options.length < 3)) modeIssues.push(`${item.id}:scenario options`);
    if (item.mode === 'estimation' && (typeof item.target !== 'number' || !item.unit)) modeIssues.push(`${item.id}:estimation target/unit`);
    if (['prediction','random'].includes(item.mode)) {
      const shape = item[`${item.mode}_shape`] || (Array.isArray(item.options) ? (item.options.length > 2 ? 'list' : 'binary') : 'open');
      const shapes = item.mode === 'prediction' ? ['binary','yesno','list','freetext','open'] : ['binary','yesno','list','freetext','open','reflection'];
      if (!shapes.includes(shape)) modeIssues.push(`${item.id}:unsupported ${item.mode} shape ${shape}`);
      if ((shape === 'binary' || shape === 'yesno') && (!Array.isArray(item.options) || item.options.length !== 2)) modeIssues.push(`${item.id}:binary options`);
      if (shape === 'list' && (!Array.isArray(item.options) || item.options.length < 3)) modeIssues.push(`${item.id}:list options`);
    }
    if (item.mode === 'brain') {
      const types = ['memory_sequence','spatial','pattern','attention_count','odd_tile','reaction','rapid_choice','memory_reverse','change_detect','rule_switch'];
      if (!types.includes(item.game_type)) modeIssues.push(`${item.id}:game_type`);
      if (!['easy','medium','hard'].includes(item.difficulty)) modeIssues.push(`${item.id}:brain difficulty`);
    }
  }
  const actualModes = {};
  for (const item of items) actualModes[item.mode] = (actualModes[item.mode] || 0) + 1;
  const duplicates = arr => [...new Map(arr.map(x => [x, (arr.filter(y => y === x).length)])).entries()].filter(([,n]) => n > 1);
  const dupIds = [...ids.entries()].filter(([, n]) => n > 1);
  const dupPrompts = [...prompts.entries()].filter(([, n]) => n > 1);
  report.data = { declaredTotal: DATA.total_items, actualTotal: items.length, declaredModes: DATA.modes, actualModes, missing, badModes, dupIds, dupPrompts, structuralIssues: modeIssues };
  assertPass('data:declared-total', DATA.total_items === items.length, `declared=${DATA.total_items} actual=${items.length}`);
  assertPass('data:mode-counts-match-declared', sameJsonObject(DATA.modes, actualModes), `declared=${JSON.stringify(DATA.modes)} actual=${JSON.stringify(actualModes)}`);
  assertPass('data:duplicate-ids', dupIds.length === 0);
  assertPass('data:duplicate-prompts', dupPrompts.length === 0);
  assertPass('data:required-fields', missing.length === 0);
  assertPass('data:mode-allowlist', badModes.length === 0);
  assertPass('data:structural-schema', modeIssues.length === 0, modeIssues.slice(0, 20).join(', '));
  assertPass('data:baseline-counts', sameJsonObject(actualModes, TARGETS.phase1Baseline.modeCounts), `actual=${JSON.stringify(actualModes)}`);
  warn('data:phase2-replacement-not-applied', `Current Phase 1 dataset remains ${items.length} items; Phase 2 target is ${TARGETS.phase2.normalModeFinalTotal} normal-mode records plus separate Brain experience definitions.`);
}

// ---------- Static file/reference gate ----------
const index = read('index.html');
const indexRefs = [...index.matchAll(/(?:src|href)=["']([^"']+)["']/g)].map(m => m[1]).filter(x => !/^(?:https?:|data:|mailto:|#)/i.test(x));
const indexMissing = [...new Set(indexRefs.filter(x => !relExists(x)))];
report.static.indexRefs = indexRefs;
assertPass('static:index-local-references', indexMissing.length === 0, indexMissing.join(', '));

const manifest = parseJson(read('manifest.webmanifest'), 'static:manifest-parse');
if (manifest) {
  function pngDimensions(filePath) {
    const b = fs.readFileSync(filePath);
    if (b.length < 24 || b[0] !== 0x89 || b[1] !== 0x50 || b[2] !== 0x4e || b[3] !== 0x47 ||
        b[4] !== 0x0d || b[5] !== 0x0a || b[6] !== 0x1a || b[7] !== 0x0a ||
        b.toString('ascii', 12, 16) !== 'IHDR') return null;
    return { width: b.readUInt32BE(16), height: b.readUInt32BE(20) };
  }
  const iconIssues = [];
  for (const icon of manifest.icons || []) {
    const rel = icon.src.replace(/^\.\//, '');
    const expected = icon.sizes?.split('x').map(Number);
    try {
      const filePath = path.join(ROOT, rel);
      const stat = fs.statSync(filePath);
      const dims = pngDimensions(filePath);
      const expectedValid = Array.isArray(expected) && expected.length === 2 && expected.every(Number.isFinite);
      const dimsMatch = !expectedValid || (!!dims && dims.width === expected[0] && dims.height === expected[1]);
      if (stat.size <= 100 || !dims || !dimsMatch) iconIssues.push(`${rel}:expected=${icon.sizes || 'unknown'}`);
    } catch { iconIssues.push(`${rel}:missing-or-unreadable`); }
  }
  assertPass('static:manifest-icons', iconIssues.length === 0, iconIssues.join(', '));
  assertPass('static:manifest-standalone', manifest.display === 'standalone');
  assertPass('static:manifest-scope', manifest.scope === './');
const versionJsForCache = read('js/version.js');
const declaredCache = versionJsForCache.match(/cache:\s*['"]([^'"]+)['"]/);
const swCache = read('service-worker.js').match(/const CACHE_NAME\s*=\s*['"]([^'"]+)['"]/);
assertPass('static:cache-version-consistency', !!declaredCache && !!swCache && declaredCache[1] === swCache[1], `${declaredCache?.[1] || 'missing'} vs ${swCache?.[1] || 'missing'}`);
}

const sw = read('service-worker.js');
const precacheBlock = sw.match(/const PRECACHE_URLS = \[(.*?)\];/s)?.[1] || '';
const precache = [...precacheBlock.matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]);
const precacheDup = [...new Set(precache.filter((x, i) => precache.indexOf(x) !== i))];
const precacheMissing = precache.filter(x => !relExists(x));
report.static.precache = { count: precache.length, duplicateEntries: precacheDup, missingEntries: precacheMissing };
assertPass('static:service-worker-precache-unique', precacheDup.length === 0, precacheDup.join(', '));
assertPass('static:service-worker-precache-existing', precacheMissing.length === 0, precacheMissing.join(', '));
assertPass('static:service-worker-syntax', runNodeCheck('service-worker.js'));

function runNodeCheck(rel) {
  try {
    execFileSync(process.execPath, ['--check', path.join(ROOT, rel)], { stdio: 'pipe' });
    return true;
  } catch (e) {
    return false;
  }
}
const jsFiles = [];
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (/\.(?:js|mjs)$/.test(entry.name)) jsFiles.push(p);
  }
}
walk(ROOT);
const syntaxFailures = jsFiles.map(p => path.relative(ROOT, p)).filter(rel => !runNodeCheck(rel));
assertPass('static:javascript-syntax', syntaxFailures.length === 0, syntaxFailures.join(', '));

const netlify = read('netlify.toml');
const requiredHeaders = ['X-Content-Type-Options', 'Referrer-Policy', 'Permissions-Policy', 'Content-Security-Policy'];
assertPass('static:netlify-publish', /publish\s*=\s*["']\.["']/.test(netlify));
assertPass('static:security-headers', requiredHeaders.every(h => netlify.includes(h)), requiredHeaders.filter(h => !netlify.includes(h)).join(', '));
assertPass('static:csp-no-eval', !netlify.includes("script-src 'self' 'unsafe-eval'"));

// ---------- Security-oriented source scan ----------
const codeFiles = jsFiles.map(p => path.relative(ROOT, p));
const patterns = [
  { name: 'eval', re: /\beval\s*\(/ },
  { name: 'new Function', re: /\bnew\s+Function\s*\(/ },
  { name: 'document.write', re: /document\.write\s*\(/ },
];
const securityHits = [];
for (const rel of codeFiles) {
  const s = read(rel);
  for (const p of patterns) if (p.re.test(s)) securityHits.push(`${rel}:${p.name}`);
}
report.security.dangerousConstructs = securityHits;
assertPass('security:no-eval-newfunction-documentwrite', securityHits.length === 0, securityHits.join(', '));
assertPass('security:user-controlled-html-helpers-present', /function escapeHtml\(/.test(read('js/utils.js')));
assertPass('security:csp-connect-src-self', /connect-src 'self'/.test(netlify));

// Conservative HTML interpolation gate. Attribute/text sinks are allowed only when their
// interpolation is explicitly escaped or is known to be developer-controlled/internal.
const dynamicHtmlReview = [];
const knownInternalInterpolation = new Set([
  'js/screens.js:16', 'js/screens.js:146', 'js/screens.js:214', 'js/screens.js:277',
  'js/screens.js:619', 'js/screens.js:862', 'js/screens.js:1065', 'js/screens.js:1072',
  'js/screens.js:1082', 'js/screens.js:1083', 'js/screens.js:1088', 'js/screens.js:1109',
  'js/modes.js:94', 'js/modes.js:170', 'js/modes.js:197', 'js/modes.js:286', 'js/modes.js:661',
  'js/modes.js:782', 'js/modes.js:870', 'js/modes.js:912', 'js/modes.js:943',
  'js/modes.js:1032', 'js/modes.js:1068', 'js/modes.js:1096', 'js/modes.js:1151', 'js/modes.js:1185'
]);
for (const rel of codeFiles) {
  const s = read(rel);
  const lines = s.split(/\n/);
  lines.forEach((line, idx) => {
    if (!/innerHTML\s*=|insertAdjacentHTML/.test(line) || !/\$\{[^}]*\}/.test(line)) return;
    const key = `${rel}:${idx + 1}`;
    if (knownInternalInterpolation.has(key) || /Utils\.escapeHtml/.test(line)) return;
    dynamicHtmlReview.push(key);
  });
}
report.security.dynamicHtmlReview = dynamicHtmlReview.slice(0, 100);
assertPass('security:dynamic-html-review', dynamicHtmlReview.length === 0,
  dynamicHtmlReview.length ? dynamicHtmlReview.join(', ') : 'all interpolation sinks are escaped or classified internal/static');
const screensSource = read('js/screens.js');
const requiredEscapedAttrs = [
  ['pick ids', 'data-pick-id="${Utils.escapeHtml(item.id)}"'],
  ['capsule revisit ids', 'data-revisit="${Utils.escapeHtml(c.id)}"'],
  ['capsule delete ids', 'data-delete-capsule="${Utils.escapeHtml(c.id)}"'],
  ['moment delete ids', 'data-delete-moment="${Utils.escapeHtml(m.id)}"'],
  ['pack play ids', 'data-play-pack="${Utils.escapeHtml(p.id)}"'],
  ['pack share ids', 'data-share-pack="${Utils.escapeHtml(p.id)}"'],
  ['pack export ids', 'data-export-pack="${Utils.escapeHtml(p.id)}"'],
  ['pack delete ids', 'data-delete-pack="${Utils.escapeHtml(p.id)}"'],
];
const missingEscapedAttrs = requiredEscapedAttrs.filter(([, expected]) => !screensSource.includes(expected)).map(([name]) => name);
assertPass('security:storage-id-html-attributes-escaped', missingEscapedAttrs.length === 0, missingEscapedAttrs.join(', '));

// ---------- Behavioral simulation: Storage + Engine without browser UI ----------
try {
  const local = new Map();
  const browser = {
    BETWEEN_DATA: DATA,
    matchMedia: () => ({ matches: false }),
  };
  const context = vm.createContext({
    window: browser,
    localStorage: {
      getItem: k => local.has(k) ? local.get(k) : null,
      setItem: (k,v) => local.set(k,String(v)),
      removeItem: k => local.delete(k),
      clear: () => local.clear(),
    },
    console,
    Math,
    Date,
    Set,
    Map,
    Object,
    Array,
    Number,
    String,
    JSON,
    URL,
    URLSearchParams,
    performance: { now: () => 0 },
    navigator: {},
    AbortController,
  });
  for (const rel of ['js/data.js','js/version.js','js/utils.js','js/storage.js','js/scoring.js','js/tendency.js','js/engine.js']) {
    vm.runInContext(read(rel), context, { filename: rel });
  }
  const Engine = vm.runInContext('Engine', context);
  const Storage = vm.runInContext('Storage', context);
  const active = ['pick_one','knowledge','scenario','estimation','prediction','random','brain'];
  const perMode = Object.fromEntries(active.map(m => [m, Engine.itemsForMode(m).length]));
  assertPass('behavior:all-active-modes-nonempty', active.every(m => perMode[m] > 0), JSON.stringify(perMode));
  const badSelections = [];
  for (const mode of active) {
    for (let i = 0; i < 60; i++) {
      const item = Engine.selectNext({ mode });
      if (!item || item.mode !== mode) badSelections.push(`${mode}:${item?.id || 'null'}`);
      else Engine.recordShown(item);
    }
  }
  assertPass('behavior:mode-selection', badSelections.length === 0, badSelections.slice(0, 10).join(', '));
  const surpriseBad = [];
  for (let i = 0; i < 250; i++) {
    const item = Engine.surpriseMe();
    if (!item) surpriseBad.push('null');
    else if (item.mode === 'majority') surpriseBad.push('majority');
    else Engine.recordShown(item);
  }
  assertPass('behavior:surprise-excludes-archived-majority', surpriseBad.length === 0, surpriseBad.slice(0, 10).join(', '));
  const daily1 = Engine.getDailySet();
  const daily2 = Engine.getDailySet();
  const dailyStable = ['pick','knowledge','chaos'].every(k => daily1[k]?.id === daily2[k]?.id);
  assertPass('behavior:daily-deterministic-same-session', dailyStable, `${daily1.pick?.id}|${daily1.knowledge?.id}|${daily1.chaos?.id}`);
  const pBefore = Storage.getProgress();
  const firstId = Engine.itemsForMode('pick_one')[0].id;
  const firstMark = Storage.markAnswered(firstId);
  const secondMark = Storage.markAnswered(firstId);
  assertPass('behavior:answered-id-dedup', firstMark === true && secondMark === false, `first=${firstMark} second=${secondMark}`);
  assertPass('behavior:seen-and-recent-progress-updates', pBefore.seenIds.length > 0 && pBefore.recentIds.length > 0, `seen=${pBefore.seenIds.length} recent=${pBefore.recentIds.length}`);
  // Stress bounded local state: recentIds must remain capped even after heavy use.
  for (let i = 0; i < 1500; i++) Engine.recordShown(Engine.itemsForMode('pick_one')[i % Engine.itemsForMode('pick_one').length]);
  const capped = Storage.getProgress();
  assertPass('behavior:recent-state-capped', capped.recentIds.length <= 15 && capped.recentModes.length <= 15 && capped.recentCategories.length <= 15 && capped.recentMoods.length <= 15, `recent=${capped.recentIds.length}/${capped.recentModes.length}/${capped.recentCategories.length}/${capped.recentMoods.length}`);
  // Corrupt-storage recovery: malformed JSON should not crash getters.
  local.set(Storage.KEYS.progress, '{not-json');
  let corruptRecovered = false;
  const priorConsoleWarn = context.console.warn;
  const priorConsoleError = context.console.error;
  context.console.warn = () => {}; context.console.error = () => {};
  try { const recovered = Storage.getProgress(); corruptRecovered = !!recovered && typeof recovered === 'object' && Array.isArray(recovered.seenIds); }
  catch {} finally { context.console.warn = priorConsoleWarn; context.console.error = priorConsoleError; }
  assertPass('behavior:corrupt-progress-recovery', corruptRecovered);
  vm.runInContext(read('js/packs.js'), context, { filename: 'js/packs.js' });
  const cleanedPack = vm.runInContext(`Packs.cleanPack({id:'<img src=x onerror=1>',title:'t',items:[{id:'<svg onload=1>',mode:'pick_one',prompt:'p',options:['a','b']}]})`, context);
  assertPass('behavior:pack-import-shape-sanitized', !!cleanedPack && cleanedPack.items.length === 1 && cleanedPack.items[0].mode === 'pick_one');
  report.behavior.modeCounts = perMode;
  report.behavior.dailyIds = { pick: daily1.pick?.id, knowledge: daily1.knowledge?.id, chaos: daily1.chaos?.id };
} catch (e) {
  status('behavior:vm-simulation', 'fail', e.stack || String(e));
}

// ---------- Final release-gate decision ----------
const blockers = report.statuses.filter(x => x.state === 'fail');
if (blockers.length === 0) status('gate:decision', 'pass', 'Phase 1.5 engineering gate passed with no automated blockers. Phase 2 content replacement remains intentionally unapplied.');
else status('gate:decision', 'fail', `${blockers.length} automated blocker(s) remain.`);

const reportPath = path.join(ROOT, 'docs', 'PHASE1_5_ENGINEERING_GATE.md');
const lines = [];
lines.push(`# BETWEEN V5 — Phase 1.5 Engineering Gate`);
lines.push('');
lines.push(`Generated: ${report.generatedAt}`);
lines.push('');
lines.push('## Decision');
lines.push('');
lines.push(report.summary.fail === 0 ? '**PASS — no automated engineering blockers found.**' : `**BLOCKED — ${report.summary.fail} automated failures.**`);
lines.push('');
lines.push('Phase 1.5 intentionally does **not** integrate the new Phase 2 content. It locks the expected content volume, proves the current Phase 1 baseline, and exercises static/data/behavioral safeguards before replacement begins.');
lines.push('');
lines.push('## Phase 2 content volume locked');
lines.push('');
lines.push('| Area | Expected |');
lines.push('|---|---:|');
for (const [mode, n] of Object.entries(TARGETS.phase2.normalModeFinalCounts)) lines.push(`| ${mode} | ${n} |`);
lines.push(`| Normal-mode total | **${TARGETS.phase2.normalModeFinalTotal}** |`);
lines.push(`| Archived Majority source | ${TARGETS.phase2.archivedMajoritySourceCount} |`);
lines.push(`| Brain player-facing experiences | ${TARGETS.phase2.brainPlayerFacingExperiences} |`);
lines.push('');
lines.push('**Important source finding:** Knowledge contains 100 numbered entries, but Knowledge #25 is explicitly marked `Verdict: REMOVE from the final library.` Therefore the Phase 2 Knowledge target is **99**, not 100.');
lines.push('');
lines.push('## Current Phase 1 baseline');
lines.push('');
lines.push(`- App version: ${appVersion}`);
lines.push(`- Embedded content version: ${DATA?.version || 'unknown'}`);
lines.push(`- Embedded items: ${DATA?.items?.length ?? 'unknown'}`);
lines.push('- Phase 1 checkpoint SHA-256: ' + TARGETS.phase1Baseline.zipSha256);
lines.push('- Current data.js SHA-256: ' + dataHash);
lines.push('');
lines.push('| Area | Current Phase 1 | Phase 2 target |');
lines.push('|---|---:|---:|');
for (const [mode, n] of Object.entries(TARGETS.phase1Baseline.modeCounts)) {
  if (mode === 'brain') lines.push(`| brain static records | ${n} | ${TARGETS.phase2.brainPlayerFacingExperiences} player-facing experiences |`);
  else if (mode === 'majority') lines.push(`| majority archive | ${n} | ${TARGETS.phase2.archivedMajoritySourceCount} source entries |`);
  else lines.push(`| ${mode} | ${n} | ${TARGETS.phase2.normalModeFinalCounts[mode]} |`);
}
lines.push('');
lines.push('## Automated results');
lines.push('');
for (const {name, state, detail} of report.statuses.filter(x => x.name !== 'gate:decision')) {
  const icon = state === 'pass' ? 'PASS' : state === 'warn' ? 'WARN' : 'FAIL';
  lines.push(`- **${icon}** ${name}${detail ? ` — ${detail}` : ''}`);
}
lines.push('');
lines.push(`### Totals: ${report.summary.pass} passed, ${report.summary.warn} warnings, ${report.summary.fail} failures`);
lines.push('');
lines.push('## Explicit limitations');
lines.push('');
lines.push('- This environment could run JavaScript syntax and headless runtime simulations, but the Chromium page-level UI harness was not reliable enough to certify real interactive browser behavior.');
lines.push('- Physical Android/PWA/offline/device testing stays in Phase 4, by design.');
lines.push('- Content quality/correctness review is Phase 2; Phase 1.5 only locks volume/schema expectations and protects the engineering base.');
lines.push('');
lines.push('## Phase 1.5 changes');
lines.push('');
lines.push('- `tools/phase15-gate.mjs` — repeatable gate runner with static, data, security, and VM behavior checks.');
lines.push('- `tools/phase15-targets.json` — machine-readable Phase 2 content targets and Phase 1 provenance, including source hashes.');
lines.push('- `docs/PHASE1_5_ENGINEERING_GATE.md` / `.json` — generated gate report.');
lines.push('- `package.json` — adds the `npm run phase15:gate` developer command.');
lines.push('- `js/screens.js` — escapes local/storage-derived IDs at HTML attribute sinks found during the gate review. No content records were replaced.');
lines.push('');
fs.writeFileSync(reportPath, lines.join('\n'));
fs.writeFileSync(path.join(ROOT, 'docs', 'PHASE1_5_ENGINEERING_GATE.json'), JSON.stringify(report, null, 2));

console.log(lines.join('\n'));

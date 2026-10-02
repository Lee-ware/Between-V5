// ===================== BACKUP (export / import) =====================
// Lets a person's history, Moments, and Time Capsules survive a browser
// reset or move to a new device/browser — without ever needing an account
// or a server. The file is just JSON; nothing here is uploaded anywhere.
//
// Because an imported file is, by definition, untrusted input (it could be
// a genuine backup, a backup from a much older version, or a file someone
// hand-edited or sent maliciously), every field is validated by shape before
// being written to storage, and every field that later gets rendered to the
// screen is escaped at render time (see Screens.momentCardHTML etc.) rather
// than trusted just because it came from "your own" backup file.

const Backup = (() => {
  const APP_TAG = 'BETWEEN';
  const EXPORT_VERSION = 2;

  const ARRAY_KEYS = ['history', 'moments', 'timeCapsules', 'reports', 'packs', 'predictions', 'brainRuns'];
  const OBJECT_KEYS = ['stats', 'settings', 'progress', 'tendency'];
  const KNOWN_MODES = new Set(['pick_one','knowledge','scenario','majority','estimation','prediction','random','brain']);

  function gather() {
    return {
      history: Storage.getHistory(),
      stats: Storage.getStats(),
      settings: Storage.getSettings(),
      progress: Storage.getProgress(),
      tendency: Storage.getTendency(),
      moments: Storage.getMoments(),
      timeCapsules: Storage.getTimeCapsules(),
      reports: Storage.getReports(),
      packs: Storage.getPacks(),
      predictions: Storage.getPredictions(),
      brainRuns: Storage.getBrainRuns(),
    };
  }

  function exportData() {
    const payload = {
      app: APP_TAG,
      exportVersion: EXPORT_VERSION,
      schemaVersion: Storage.SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: gather(),
    };
    const json = JSON.stringify(payload, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `between-backup-${Utils.todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    return payload;
  }

  const MAX_IMPORT_BYTES = 2 * 1024 * 1024;

  function cleanString(value, max = 500) {
    return typeof value === 'string' ? value.slice(0, max) : null;
  }

  function cleanHistory(arr) {
    return (Array.isArray(arr) ? arr : []).filter(x => x && typeof x === 'object' && typeof x.id === 'string' && typeof x.mode === 'string')
      .slice(-500).map(x => ({
        id: x.id.slice(0, 80), mode: x.mode.slice(0, 40), category: cleanString(x.category, 80),
        ts: Number.isFinite(x.ts) ? x.ts : Date.now(), success: x.success === true ? true : x.success === false ? false : null,
      }));
  }

  function cleanMoments(arr) {
    return (Array.isArray(arr) ? arr : []).filter(x => x && typeof x === 'object')
      .slice(-300).map(x => ({
        id: cleanString(x.id, 100) || ('moment_' + Math.random().toString(36).slice(2)),
        itemId: cleanString(x.itemId, 80), mode: cleanString(x.mode, 40), category: cleanString(x.category, 80),
        prompt: cleanString(x.prompt, 600) || '', chosenText: cleanString(x.chosenText, 400), resultLabel: cleanString(x.resultLabel, 200),
        success: x.success === true ? true : x.success === false ? false : null,
        dateKey: /^\d{4}-\d{2}-\d{2}$/.test(String(x.dateKey || '')) ? x.dateKey : Utils.todayKey(),
        ts: Number.isFinite(x.ts) ? x.ts : Date.now(),
      }));
  }

  function cleanCapsules(arr) {
    return (Array.isArray(arr) ? arr : []).filter(x => x && typeof x === 'object')
      .slice(-200).map(x => ({
        id: cleanString(x.id, 100) || ('capsule_' + Math.random().toString(36).slice(2)),
        itemId: cleanString(x.itemId, 80), mode: cleanString(x.mode, 40), category: cleanString(x.category, 80),
        prompt: cleanString(x.prompt, 600) || '', originalAnswer: cleanString(x.originalAnswer, 400) || '',
        dateKey: /^\d{4}-\d{2}-\d{2}$/.test(String(x.dateKey || '')) ? x.dateKey : Utils.todayKey(),
        ts: Number.isFinite(x.ts) ? x.ts : Date.now(), periodKey: ['30d','1y','whenever'].includes(x.periodKey) ? x.periodKey : 'whenever',
        revisitAt: x.revisitAt === null || Number.isFinite(x.revisitAt) ? x.revisitAt : null,
        opened: x.opened === true, newAnswer: cleanString(x.newAnswer, 400), openedTs: Number.isFinite(x.openedTs) ? x.openedTs : null,
        sameChoice: x.sameChoice === true ? true : x.sameChoice === false ? false : null,
      }));
  }


  function cleanReports(arr) {
    return (Array.isArray(arr) ? arr : []).filter(x => x && typeof x === 'object')
      .slice(-300).map(x => ({
        id: cleanString(x.id, 100) || ('report_' + Math.random().toString(36).slice(2)),
        itemId: cleanString(x.itemId, 80) || '',
        mode: KNOWN_MODES.has(String(x.mode || '')) ? String(x.mode) : 'unknown',
        reason: cleanString(x.reason, 80) || 'other',
        note: cleanString(x.note, 500) || '',
        ts: Number.isFinite(x.ts) ? x.ts : Date.now(),
      }));
  }

  function cleanPredictions(arr) {
    return (Array.isArray(arr) ? arr : []).filter(x => x && typeof x === 'object')
      .slice(-300).map(x => {
        const shape = ['binary','yesno','list','freetext','open','numeric'].includes(String(x.shape || '')) ? String(x.shape) : 'open';
        const predictedValue = shape === 'numeric'
          ? (Number.isFinite(Number(x.predictedValue)) ? Number(x.predictedValue) : null)
          : cleanString(x.predictedValue, 300);
        if (predictedValue === null || predictedValue === '') return null;
        const actualNumeric = shape === 'numeric' ? (Number.isFinite(Number(x.actualValue)) ? Number(x.actualValue) : null) : null;
        return {
          id: cleanString(x.id, 100) || ('prediction_' + Math.random().toString(36).slice(2)),
          itemId: cleanString(x.itemId, 100) || '', mode: 'prediction',
          category: cleanString(x.category, 100) || 'Prediction', prompt: cleanString(x.prompt, 800) || '',
          shape, options: Array.isArray(x.options) ? x.options.slice(0, 8).filter(v => typeof v === 'string').map(v => v.slice(0, 300)) : [],
          predictedValue, predictedDisplay: cleanString(x.predictedDisplay, 300) || String(predictedValue),
          resolutionCondition: cleanString(x.resolutionCondition, 500) || '',
          resolutionWindow: cleanString(x.resolutionWindow, 180) || null,
          createdAt: Number.isFinite(x.createdAt) ? x.createdAt : Date.now(),
          createdDateKey: /^\d{4}-\d{2}-\d{2}$/.test(String(x.createdDateKey || '')) ? x.createdDateKey : Utils.todayKey(),
          eligibleAt: x.eligibleAt === null || Number.isFinite(x.eligibleAt) ? x.eligibleAt : null,
          status: x.status === 'resolved' ? 'resolved' : 'pending',
          actualValue: shape === 'numeric' ? actualNumeric : (x.actualValue == null ? null : cleanString(x.actualValue, 300)),
          actualDisplay: cleanString(x.actualDisplay, 300) || null,
          outcome: ['hit','miss','resolved'].includes(x.outcome) ? x.outcome : null,
          resolvedAt: Number.isFinite(x.resolvedAt) ? x.resolvedAt : null,
        };
      }).filter(Boolean);
  }

  function cleanBrainRuns(arr) {
    return (Array.isArray(arr) ? arr : []).slice(-100).map(x => {
      if (!x || typeof x !== 'object') return null;
      const dims = x.dimensions && typeof x.dimensions === 'object' ? x.dimensions : {};
      const out = {};
      ['Accuracy','Speed','Memory','Switching','Consistency'].forEach(k => {
        const n = Number(dims[k]); if (Number.isFinite(n)) out[k] = Math.max(0, Math.min(100, Math.round(n)));
      });
      return {
        runId: cleanString(x.runId, 100) || ('brainrun_' + Math.random().toString(36).slice(2)),
        itemId: cleanString(x.itemId, 100), itemTitle: cleanString(x.itemTitle, 120),
        daily: x.daily === true, seed: Number.isFinite(x.seed) ? x.seed : null,
        completed: x.completed === true, dimensions: out,
        score: Number.isFinite(Number(x.score)) ? Math.max(0, Math.min(100, Number(x.score))) : 0,
        strongest: cleanString(x.strongest, 40) || null,
        startedAt: Number.isFinite(x.startedAt) ? x.startedAt : null,
        endedAt: Number.isFinite(x.endedAt) ? x.endedAt : null,
        durationMs: Number.isFinite(x.durationMs) ? Math.max(0, x.durationMs) : 0,
        stages: Array.isArray(x.stages) ? x.stages.slice(0, 20).map(r => ({
          index: Number.isInteger(r.index) ? r.index : 0, type: cleanString(r.type, 50) || 'unknown',
          title: cleanString(r.title, 100), level: Number.isFinite(r.level) ? Math.max(1, Math.min(5, r.level)) : 1,
          correct: r.correct === true, errors: Number.isFinite(r.errors) ? Math.max(0, r.errors) : 0,
          timeMs: Number.isFinite(r.timeMs) ? Math.max(0, r.timeMs) : 0,
          performance: Number.isFinite(r.performance) ? Math.max(0, Math.min(1, r.performance)) : 0,
          dimension: cleanString(r.dimension, 40) || 'accuracy',
        })) : [],
      };
    }).filter(Boolean);
  }

  function cleanPacks(arr) {
    return (Array.isArray(arr) ? arr : []).slice(-50).map(x => {
      try {
        const cleaned = typeof Packs !== 'undefined' ? Packs.cleanPack(x) : null;
        return cleaned;
      } catch (e) { return null; }
    }).filter(Boolean);
  }

  function cleanStats(raw) {
    const s = Object.assign(Storage.defaultStats(), raw && typeof raw === 'object' ? raw : {});
    const numeric = ['answered','correctKnowledge','totalKnowledge','pickOneCount','scenarioCount','majorityCorrect','majorityTotal','estimationTotal','estimationAccuracySum','predictionCount','randomCount','brainBestScore','brainCount','currentStreak','longestStreak','totalSessions'];
    numeric.forEach(k => { s[k] = Number.isFinite(Number(s[k])) && Number(s[k]) >= 0 ? Number(s[k]) : 0; });
    s.closestEstimatePct = s.closestEstimatePct === null ? null : (Number.isFinite(Number(s.closestEstimatePct)) ? Number(s.closestEstimatePct) : null);
    s.byMode = s.byMode && typeof s.byMode === 'object' && !Array.isArray(s.byMode) ? Object.fromEntries(Object.entries(s.byMode).filter(([k,v]) => KNOWN_MODES.has(k) && Number.isFinite(Number(v)) && Number(v) >= 0).map(([k,v]) => [k, Number(v)])) : {};
    s.byCategory = s.byCategory && typeof s.byCategory === 'object' && !Array.isArray(s.byCategory) ? Object.fromEntries(Object.entries(s.byCategory).slice(0, 200).map(([k,v]) => [String(k).slice(0,80), { count: Number.isFinite(Number(v && v.count)) && Number(v.count) >= 0 ? Number(v.count) : 0 }])) : {};
    s.daysActive = Array.isArray(s.daysActive) ? s.daysActive.filter(x => /^\d{4}-\d{2}-\d{2}$/.test(String(x))).slice(-365) : [];
    s.lastActiveDate = /^\d{4}-\d{2}-\d{2}$/.test(String(s.lastActiveDate || '')) ? s.lastActiveDate : null;
    s.firstSessionComplete = s.firstSessionComplete === true;
    return s;
  }

  function cleanSettings(raw) {
    const s = Object.assign(Storage.defaultSettings(), raw && typeof raw === 'object' ? raw : {});
    s.sound = s.sound === true; s.reducedMotion = s.reducedMotion === true; s.personalization = s.personalization !== false; s.theme = 'dark';
    return s;
  }

  function cleanProgress(raw) {
    const p = Object.assign(Storage.defaultProgress(), raw && typeof raw === 'object' ? raw : {});
    ['seenIds','recentIds','recentSimilarity','recentModes','recentCategories','recentMoods'].forEach(k => {
      p[k] = Array.isArray(p[k]) ? p[k].filter(x => typeof x === 'string').slice(-1000) : [];
    });
    // Unique answered progress is deliberately independent of the 500-entry history log.
    p.answeredIds = Array.isArray(p.answeredIds)
      ? p.answeredIds.filter(x => typeof x === 'string' && x).slice(-20000)
      : [];
    const currentContentVersion = String((window.BETWEEN_DATA && window.BETWEEN_DATA.version) || 'unknown');
    if (p.answeredContentVersion && String(p.answeredContentVersion) !== currentContentVersion) {
      p.answeredIds = [];
    }
    p.answeredContentVersion = currentContentVersion;
    p.dailyDoneDates = p.dailyDoneDates && typeof p.dailyDoneDates === 'object' && !Array.isArray(p.dailyDoneDates) ? p.dailyDoneDates : {};
    p.onboardingIndex = Number.isFinite(Number(p.onboardingIndex)) ? Math.max(0, Math.min(100, Number(p.onboardingIndex))) : 0;
    p.onboardingDone = p.onboardingDone === true;
    p.installNudgeDismissed = p.installNudgeDismissed === true;
    return p;
  }

  function cleanTendency(raw) {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return Storage.defaultTendency();
    const out = {};
    Object.entries(raw).slice(0, 50).forEach(([axis, values]) => {
      if (!values || typeof values !== 'object' || Array.isArray(values)) return;
      out[axis.slice(0, 80)] = {};
      Object.entries(values).slice(0, 20).forEach(([pole, count]) => {
        const n = Number(count); if (Number.isFinite(n) && n >= 0) out[axis.slice(0,80)][pole.slice(0,80)] = n;
      });
    });
    return out;
  }

  function validate(obj) {
    if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return { valid: false, reason: "That file doesn't look like a BETWEEN backup." };
    if (obj.app !== APP_TAG) return { valid: false, reason: "That file doesn't look like a BETWEEN backup." };
    if (!obj.data || typeof obj.data !== 'object' || Array.isArray(obj.data)) return { valid: false, reason: 'This backup file is missing its data.' };
    for (const k of ARRAY_KEYS) if (obj.data[k] !== undefined && !Array.isArray(obj.data[k])) return { valid: false, reason: `The "${k}" section of this file isn't in the format BETWEEN expects.` };
    for (const k of OBJECT_KEYS) if (obj.data[k] !== undefined && (typeof obj.data[k] !== 'object' || Array.isArray(obj.data[k]) || obj.data[k] === null)) return { valid: false, reason: `The "${k}" section of this file isn't in the format BETWEEN expects.` };
    return { valid: true };
  }

  function importData(obj) {
    const d = obj.data || {};
    const cleanedHistory = Array.isArray(d.history) ? cleanHistory(d.history) : [];
    if (Array.isArray(d.history)) Storage.setHistory(cleanedHistory);
    if (d.stats) Storage.setStats(cleanStats(d.stats));
    if (d.settings) Storage.setSettings(cleanSettings(d.settings));
    if (d.progress) {
      const cleanedProgress = cleanProgress(d.progress);
      // Older backups may not have answeredIds. Reconstruct them from the
      // retained history without ever treating seenIds as answered.
      const answered = new Set(Array.isArray(cleanedProgress.answeredIds) ? cleanedProgress.answeredIds : []);
      cleanedHistory.forEach(entry => { if (entry && typeof entry.id === 'string' && entry.id) answered.add(entry.id); });
      cleanedProgress.answeredIds = Array.from(answered);
      Storage.setProgress(cleanedProgress);
    }
    if (d.tendency) Storage.setTendency(cleanTendency(d.tendency));
    if (Array.isArray(d.moments)) Storage.setMoments(cleanMoments(d.moments));
    if (Array.isArray(d.timeCapsules)) Storage.setTimeCapsules(cleanCapsules(d.timeCapsules));
    if (Array.isArray(d.reports)) Storage.setReports(cleanReports(d.reports));
    if (Array.isArray(d.packs)) Storage.setPacks(cleanPacks(d.packs));
    if (Array.isArray(d.predictions)) Storage.setPredictions(cleanPredictions(d.predictions));
    if (Array.isArray(d.brainRuns)) Storage.setBrainRuns(cleanBrainRuns(d.brainRuns));
    Storage.clearSession();
  }

  // Opens the browser's native file picker, reads + parses + validates the
  // chosen file, and calls back with either {payload} or {error}. Never
  // touches storage itself — the caller decides what to do (e.g. confirm
  // with the person before overwriting anything).
  function promptImportFile(callback) {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'application/json,.json';
    input.style.display = 'none';

    input.addEventListener('change', () => {
      const file = input.files && input.files[0];
      document.body.removeChild(input);
      if (!file) return;
      if (file.size > MAX_IMPORT_BYTES) { callback({ error: 'That backup file is too large.' }); return; }

      const reader = new FileReader();
      reader.onload = () => {
        let parsed;
        try {
          parsed = JSON.parse(reader.result);
        } catch (e) {
          callback({ error: "That file isn't valid JSON." });
          return;
        }
        const check = validate(parsed);
        if (!check.valid) { callback({ error: check.reason }); return; }
        callback({ payload: parsed });
      };
      reader.onerror = () => callback({ error: 'Could not read that file.' });
      reader.readAsText(file);
    });

    document.body.appendChild(input);
    input.click();
  }

  return { exportData, validate, importData, promptImportFile };
})();

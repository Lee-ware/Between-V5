// ===================== PREDICTIONS =====================
// Local-only prediction ledger. BETWEEN never pretends to know whether a
// personal prediction came true; the person resolves it themselves.

const Predictions = (() => {
  const MAX = 300;
  const NUMERIC_RE = /\bhow many\b|\bhow long\b|\bhow much\b/i;

  function sanitizeText(value, max = 500) {
    return typeof value === 'string' ? value.slice(0, max) : '';
  }

  function parseEligibleAt(windowText, createdAt) {
    const raw = sanitizeText(windowText, 160).trim().toLowerCase();
    if (!raw) return null;
    const base = Number.isFinite(createdAt) ? createdAt : Date.now();
    if (/tomorrow/.test(raw)) return base + 24 * 60 * 60 * 1000;
    const days = raw.match(/next\s+(\d+)\s+days?/);
    if (days) return base + Number(days[1]) * 24 * 60 * 60 * 1000;
    const month = /next\s+month|within\s+the\s+next\s+month/.test(raw);
    if (month) {
      const d = new Date(base);
      d.setMonth(d.getMonth() + 1);
      return d.getTime();
    }
    const year = /one\s+year\s+from\s+now|next\s+year|within\s+the\s+next\s+year/.test(raw);
    if (year) {
      const d = new Date(base);
      d.setFullYear(d.getFullYear() + 1);
      return d.getTime();
    }
    if (/before\s+this\s+year\s+ends?|by\s+the\s+end\s+of\s+this\s+year/.test(raw)) {
      const d = new Date(base);
      d.setMonth(11, 31);
      d.setHours(23, 59, 59, 999);
      return d.getTime();
    }
    // Deliberately return null rather than inventing a resolution date.
    return null;
  }

  function formatDate(ts) {
    if (!Number.isFinite(ts)) return '';
    try { return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }); }
    catch (e) { return ''; }
  }

  function isNumericShape(item) {
    return item && item.prediction_shape === 'numeric';
  }

  function save(item, result) {
    if (!item || item.mode !== 'prediction') return null;
    const shape = item.prediction_shape || (item.options ? (item.options.length > 2 ? 'list' : 'binary') : 'open');
    let predictedValue = null;
    let predictedDisplay = '';
    if (shape === 'numeric') {
      if (!Number.isFinite(Number(result && result.predictionValue))) return null;
      predictedValue = Number(result.predictionValue);
      predictedDisplay = Utils.fmtNum(predictedValue);
    } else if (result && result.chosenText) {
      predictedValue = sanitizeText(result.chosenText, 300);
      predictedDisplay = predictedValue;
    } else if (result && result.freetext) {
      predictedValue = sanitizeText(result.freetext, 300);
      predictedDisplay = predictedValue;
    } else {
      return null;
    }

    const now = Date.now();
    const entry = {
      id: 'prediction_' + now.toString(36) + '_' + Math.random().toString(36).slice(2, 8),
      itemId: sanitizeText(item.id, 100),
      mode: 'prediction',
      category: sanitizeText(item.category, 100),
      prompt: sanitizeText(item.prompt, 800),
      shape,
      options: Array.isArray(item.options) ? item.options.slice(0, 8).map(x => sanitizeText(x, 300)) : [],
      predictedValue,
      predictedDisplay,
      resolutionCondition: sanitizeText(item.resolution_condition || item.prompt, 500),
      resolutionWindow: sanitizeText(item.resolution_window, 180) || null,
      createdAt: now,
      createdDateKey: Utils.todayKey(),
      eligibleAt: parseEligibleAt(item.resolution_window, now),
      status: 'pending',
      actualValue: null,
      actualDisplay: null,
      outcome: null,
      resolvedAt: null,
    };
    Storage.updatePredictions(arr => {
      arr.push(entry);
      if (arr.length > MAX) arr.splice(0, arr.length - MAX);
    });
    return entry;
  }

  function getAll() {
    return Storage.getPredictions().slice().sort((a, b) => b.createdAt - a.createdAt);
  }

  function isReady(entry) {
    if (!entry || entry.status === 'resolved') return false;
    return entry.eligibleAt === null || !Number.isFinite(entry.eligibleAt) || Date.now() >= entry.eligibleAt;
  }

  function status(entry) {
    if (entry.status === 'resolved') return 'resolved';
    return isReady(entry) ? 'ready' : 'waiting';
  }

  function resolve(id, actualValue, outcomeOverride) {
    let updated = null;
    Storage.updatePredictions(arr => {
      const entry = arr.find(x => x.id === id);
      if (!entry || entry.status === 'resolved' || !isReady(entry)) return;

      let outcome = outcomeOverride || null;
      let actual = actualValue;
      if (entry.shape === 'numeric') {
        const predicted = Number(entry.predictedValue);
        const actualNum = Number(actualValue);
        if (!Number.isFinite(actualNum) || !Number.isFinite(predicted)) return;
        actual = actualNum;
        outcome = actualNum === predicted ? 'hit' : 'miss';
      } else {
        actual = sanitizeText(actualValue, 300);
        if (!outcome && entry.options && entry.options.length) {
          outcome = actual === entry.predictedValue ? 'hit' : 'miss';
        }
        if (!outcome) outcome = 'resolved';
      }

      entry.actualValue = actual;
      entry.actualDisplay = entry.shape === 'numeric' ? Utils.fmtNum(actual) : sanitizeText(actual, 300);
      entry.outcome = outcome;
      entry.status = 'resolved';
      entry.resolvedAt = Date.now();
      updated = { ...entry };
    });
    return updated;
  }

  function remove(id) {
    Storage.updatePredictions(arr => {
      const i = arr.findIndex(x => x.id === id);
      if (i >= 0) arr.splice(i, 1);
    });
  }

  function summary() {
    const all = getAll();
    return {
      total: all.length,
      pending: all.filter(x => status(x) === 'waiting').length,
      ready: all.filter(x => status(x) === 'ready').length,
      resolved: all.filter(x => x.status === 'resolved').length,
      hits: all.filter(x => x.outcome === 'hit').length,
      misses: all.filter(x => x.outcome === 'miss').length,
    };
  }

  return {
    MAX, NUMERIC_RE, parseEligibleAt, formatDate, isNumericShape,
    save, getAll, isReady, status, resolve, remove, summary,
  };
})();

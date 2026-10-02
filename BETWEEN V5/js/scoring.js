// ===================== SCORING =====================

const Scoring = (() => {

  // Estimation: hybrid relative + log-scale error model (spec section 21)
  function estimationAccuracy(guess, target) {
    const eps = 1e-9;
    const g = Math.abs(Number(guess));
    const t = Math.abs(Number(target));

    const relativeError = Math.abs(g - t) / Math.max(t, eps);
    const linearAccuracy = Math.max(0, 1 - relativeError);

    const logError = Math.abs(Math.log10(Math.max(g, eps)) - Math.log10(Math.max(t, eps)));
    const logAccuracy = Math.max(0, 1 - logError / 3); // 3 orders of magnitude = 0 accuracy

    // Blend: for reasonable-scale numbers, relative error dominates;
    // for huge-range numbers, log error smooths out unfair punishment.
    const accuracy = Math.max(linearAccuracy, logAccuracy);
    const pctOff = relativeError * 100;

    return {
      accuracy: Math.max(0, Math.min(1, accuracy)),
      pctOff,
      score: Math.round(Math.max(0, Math.min(1, accuracy)) * 100),
    };
  }

  // Source-aware estimation scoring. Ranges and lower bounds are treated as
  // ranges, not silently collapsed to a fake exact number.
  function estimationAccuracyForItem(guess, item) {
    if (!item || item.target_kind === 'text') return { accuracy: 0, pctOff: 100, score: 0, withinRange: false };
    const g = Math.abs(Number(guess));
    if (!Number.isFinite(g)) return { accuracy: 0, pctOff: Infinity, score: 0, withinRange: false };
    if (item.target_kind === 'range' && Number.isFinite(item.target_min) && Number.isFinite(item.target_max)) {
      const min = Math.abs(Number(item.target_min));
      const max = Math.abs(Number(item.target_max));
      if (g >= Math.min(min, max) && g <= Math.max(min, max)) {
        return { accuracy: 1, pctOff: 0, score: 100, withinRange: true };
      }
      const nearest = g < min ? min : max;
      const { accuracy, pctOff, score } = estimationAccuracy(g, nearest);
      return { accuracy, pctOff, score, withinRange: false };
    }
    if (item.target_kind === 'lower_bound' && Number.isFinite(item.target)) {
      const t = Math.abs(Number(item.target));
      if (g >= t) return { accuracy: 1, pctOff: 0, score: 100, withinRange: true };
      const { accuracy, pctOff, score } = estimationAccuracy(g, t);
      return { accuracy, pctOff, score, withinRange: false };
    }
    const target = Number.isFinite(item.target) ? item.target : null;
    if (target === null) return { accuracy: 0, pctOff: 100, score: 0, withinRange: false };
    const { accuracy, pctOff, score } = estimationAccuracy(g, target);
    return { accuracy, pctOff, score, withinRange: false };
  }

  function estimationFeedback(pctOff) {
    if (pctOff <= 2) return "Scarily precise.";
    if (pctOff <= 10) return "Pretty close.";
    if (pctOff <= 25) return "Solid ballpark.";
    if (pctOff <= 60) return "Not far off.";
    if (pctOff <= 150) return "A stretch, but reasonable.";
    return "Wildly off — but now you know.";
  }

  function bumpStreak(stats, wasSuccess) {
    if (wasSuccess === null || wasSuccess === undefined) return; // neutral experiences don't affect streak
    if (wasSuccess) {
      stats.currentStreak += 1;
      if (stats.currentStreak > stats.longestStreak) stats.longestStreak = stats.currentStreak;
    } else {
      stats.currentStreak = 0;
    }
  }

  function recordCategory(stats, category) {
    if (!category) return;
    stats.byCategory[category] = stats.byCategory[category] || { count: 0 };
    stats.byCategory[category].count += 1;
  }

  function recordMode(stats, mode) {
    stats.byMode[mode] = (stats.byMode[mode] || 0) + 1;
  }

  function recordActiveDay(stats) {
    const today = Utils.todayKey();
    if (stats.lastActiveDate !== today) {
      stats.lastActiveDate = today;
      if (!stats.daysActive.includes(today)) stats.daysActive.push(today);
      if (stats.daysActive.length > 365) stats.daysActive.shift();
    }
  }

  // Rolling day-streak based on consecutive daysActive
  function dayStreak(stats) {
    if (!stats.daysActive.length) return 0;
    const set = new Set(stats.daysActive);
    let streak = 0;
    let d = new Date();
    for (;;) {
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (set.has(key)) {
        streak++;
        d.setDate(d.getDate() - 1);
      } else {
        break;
      }
    }
    return streak;
  }

  function accuracyPct(stats) {
    // Knowledge self-reports are the only mode with a real ground-truth answer,
    // so overall "accuracy" is based on that (majority has no verifiable outcome in V1).
    if (stats.totalKnowledge === 0) return null;
    return Math.round((stats.correctKnowledge / stats.totalKnowledge) * 100);
  }

  return {
    estimationAccuracy, estimationAccuracyForItem, estimationFeedback,
    bumpStreak, recordCategory, recordMode, recordActiveDay,
    dayStreak, accuracyPct,
  };
})();

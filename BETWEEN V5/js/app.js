// ===================== APP CONTROLLER =====================

const App = (() => {
  const ROUND_LENGTH = 10;
  const root = () => document.getElementById('app');
  const TAB_SCREENS = ['home', 'modes', 'daily', 'profile', 'settings', 'moments', 'timecapsules', 'predictions', 'ptpsetup', 'packs', 'duel'];

  let singleFlow = null;      // { returnTo, dailyKey, dailyDateKey }
  let deferredInstallPrompt = null;
  let currentTab = 'home';    // last rendered top-level tab screen (back-navigation target)
  let renderGuard = false;    // prevents recursive error-boundary loops
  let activeCapsuleId = null; // capsule currently open in the revisit flow (in-memory only)
  let ptpMatch = null;        // in-progress Pass the Phone match (in-memory only, by design —
                               // see CHANGELOG_V3_PASSTHEPHONE.md for why this doesn't persist)
  let experienceTokenCounter = 0;
  let activeExperienceToken = null; // invalidates callbacks from screens that are no longer active
  let committedExperienceToken = null; // prevents duplicate result commits before Next is pressed

  // ---------------- Error boundary ----------------
  // Every screen render is wrapped so a bug in one mode/screen can never produce
  // a blank white page — the person always lands on a recognizable, recoverable state.
  function safeRender(fn, label) {
    try {
      fn();
    } catch (err) {
      console.error(`[BETWEEN] render failed (${label})`, err);
      if (renderGuard) return; // avoid loops if the error screen itself fails
      renderGuard = true;
      try {
        Screens.errorState(root(), {
          onRetry: () => { renderGuard = false; navigate('home'); },
        });
      } finally {
        renderGuard = false;
      }
    }
  }

  // ---------------- Navigation (with real back-stack support) ----------------
  function pushHistory(state, replace) {
    try {
      const method = replace ? 'replaceState' : 'pushState';
      history[method](state, '', '#' + state.screen);
    } catch (e) { /* history API unavailable in some embedded contexts — degrade silently */ }
  }

  function renderTabScreen(screen, fromPopstate, replaceHistory = false) {
    if (typeof BrainEngine !== 'undefined' && typeof BrainEngine.cancel === 'function') BrainEngine.cancel();
    activeExperienceToken = null;
    committedExperienceToken = null;
    if (!TAB_SCREENS.includes(screen)) screen = 'home';
    singleFlow = null;
    currentTab = screen;
    const r = root();
    safeRender(() => {
      switch (screen) {
        case 'home': Screens.home(r); break;
        case 'modes': Screens.modes(r); break;
        case 'daily': Screens.daily(r); break;
        case 'profile': Screens.profile(r); break;
        case 'settings': Screens.settings(r); break;
        case 'moments': Screens.moments(r); break;
        case 'timecapsules': Screens.timeCapsules(r); break;
        case 'predictions': Screens.predictions(r); break;
        case 'ptpsetup': Screens.ptpSetup(r); break;
        case 'packs': Screens.packs(r); break;
        case 'duel': if (window.__BETWEEN_DUEL_TOKEN) { const t=window.__BETWEEN_DUEL_TOKEN; window.__BETWEEN_DUEL_TOKEN=null; Screens.duelFromUrl(r,t); } else Screens.duelLanding(r); break;
        default: Screens.home(r);
      }
    }, screen);
    if (!fromPopstate) pushHistory({ screen }, replaceHistory);
    window.scrollTo(0, 0);
  }

  function navigate(screen, replaceHistory = false) { renderTabScreen(screen, false, replaceHistory); }

  function back() {
    if (window.history.length > 1) history.back();
    else navigate(currentTab || 'home');
  }

  window.addEventListener('popstate', (e) => {
    const state = e.state || { screen: 'home' };
    if (state.screen === 'experience') {
      // Only reachable if the user navigated forward again after going back;
      // safest recovery is resuming the session if one still exists.
      const session = Storage.getSession();
      if (session) { renderExperience(Engine.getItem(session.currentItemId), session); return; }
      renderTabScreen('home', true);
      return;
    }
    if (state.screen === 'capsule-revisit') {
      // Only reachable via in-memory state (not persisted across a hard
      // refresh) — if it's gone, the list is the safest place to land.
      if (activeCapsuleId) {
        const capsule = TimeCapsule.getAll().find(c => c.id === activeCapsuleId);
        safeRender(() => Screens.timeCapsuleRevisit(root(), capsule), 'capsule-revisit');
        return;
      }
      renderTabScreen('timecapsules', true);
      return;
    }
    if (state.screen === 'ptp') {
      if (ptpMatch) { ptpRender(); return; }
      renderTabScreen('ptpsetup', true);
      return;
    }
    renderTabScreen(state.screen || 'home', true);
  });

  function openCapsule(id) {
    activeCapsuleId = id;
    const capsule = TimeCapsule.getAll().find(c => c.id === id);
    pushHistory({ screen: 'capsule-revisit' });
    safeRender(() => Screens.timeCapsuleRevisit(root(), capsule), 'capsule-revisit');
  }

  // ---------------- Pass the Phone ----------------
  function startPassThePhone(gameMode, roundLength = 5) {
    ptpMatch = PassThePhone.newMatch(gameMode, roundLength);
    if (!ptpMatch.questions.length) { Screens.toast('Not enough questions available right now.'); return; }
    pushHistory({ screen: 'ptp' }, true);
    ptpRender();
  }

  function ptpRender() {
    safeRender(() => {
      if (!ptpMatch) { navigate('ptpsetup'); return; }
      if (PassThePhone.isDone(ptpMatch)) {
        Screens.ptpResults(root(), ptpMatch, {
          onAgain: () => startPassThePhone(ptpMatch.gameMode, ptpMatch.roundLength),
          onDone: () => { ptpMatch = null; back(); },
        });
      } else {
        Screens.ptpPlay(root(), ptpMatch, {
          onAnswer: (answer) => {
            if (ptpMatch.phase === 'p1_turn') PassThePhone.submitP1(ptpMatch, answer);
            else PassThePhone.submitP2(ptpMatch, answer);
            ptpRender();
          },
          onHandoff: () => { PassThePhone.confirmHandoff(ptpMatch); ptpRender(); },
          onNextRound: () => { PassThePhone.nextRound(ptpMatch); ptpRender(); },
          onExit: () => { ptpMatch = null; back(); },
        });
      }
    }, 'ptp');
  }

  // ---------------- Session (round) management ----------------
  function newRoundState(type, mode) {
    return { type, mode: mode || null, count: 0, results: [] };
  }

  function pickForSession(session) {
    if (session.type === 'pack') { return session.packItems[Math.max(0, session.round.count)] || null; }
    if (session.type === 'mode') {
      return Engine.selectNext({ mode: session.mode });
    }
    return Engine.surpriseMe();
  }

  function beginSession(opts) {
    const type = opts.type;
    const mode = opts.mode || null;
    if (mode && Engine.ARCHIVED_MODES && Engine.ARCHIVED_MODES.includes(mode)) {
      Screens.toast('That experiment is currently archived.');
      return;
    }
    const round = newRoundState(type, mode);
    const item = opts.firstItem || pickForSession({ type, mode });
    if (!item) { Screens.toast('Nothing to show right now.'); return; }

    Engine.recordShown(item);
    round.count = 1;

    const session = {
      type, mode,
      round,
      currentItemId: item.id,
      currentIsMystery: type === 'mystery' && opts.isMysteryFirst !== false,
      originTab: currentTab,
      packItems: Array.isArray(opts.packItems) ? opts.packItems.slice(0, 10) : null,
    };
    Storage.setSession(session);
    pushHistory({ screen: 'experience' });
    renderExperience(item, session);
  }

  function resumeSession() {
    const session = Storage.getSession();
    if (!session) { navigate('home'); return; }
    const item = Engine.getItem(session.currentItemId);
    if (!item) { Storage.clearSession(); navigate('home'); return; }
    pushHistory({ screen: 'experience' });
    renderExperience(item, session);
  }

  function renderExperience(item, session) {
    singleFlow = null;
    const token = ++experienceTokenCounter;
    activeExperienceToken = token;
    committedExperienceToken = null;
    safeRender(() => {
      Screens.experience(root(), item, {
        isMystery: session.currentIsMystery,
        isDaily: false,
        progressLabel: `#${session.round.count}`,
        experienceToken: token,
      });
    }, 'experience:' + (item && item.mode));
  }

  function startSingle(item, opts) {
    if (typeof BrainEngine !== 'undefined' && typeof BrainEngine.cancel === 'function') BrainEngine.cancel();
    if (item && Engine.ARCHIVED_MODES && Engine.ARCHIVED_MODES.includes(item.mode)) {
      Screens.toast('That experiment is currently archived.');
      return;
    }
    singleFlow = opts;
    Engine.recordShown(item);
    const token = ++experienceTokenCounter;
    activeExperienceToken = token;
    committedExperienceToken = null;
    pushHistory({ screen: 'experience' });
    safeRender(() => {
      Screens.experience(root(), item, { isMystery: false, isDaily: !!(opts && opts.dailyKey), progressLabel: '', experienceToken: token });
    }, 'experience-single:' + item.mode);
  }

  function exitExperience() {
    if (typeof BrainEngine !== 'undefined' && typeof BrainEngine.cancel === 'function') BrainEngine.cancel();
    activeExperienceToken = null;
    committedExperienceToken = null;
    // Session (if any) stays persisted so "Continue" can resume it.
    // Use the browser history so the same behavior works for the on-screen
    // back button and the device/browser back gesture.
    back();
  }

  function handleBrainRun(summary) {
    if (!summary || typeof summary !== 'object') return false;
    if (typeof Storage.addBrainRun === 'function') Storage.addBrainRun(summary);
    return true;
  }

  function reportItem(item) {
    if (Reports.hasReported(item.id)) { Screens.toast('You already reported this experience.'); return; }
    Screens.openReportSheet(item, (reason, note) => { Reports.add(item, reason, note); Screens.toast('Report saved on this device.'); });
  }

  // ---------------- Result handling ----------------
  function handleResult(item, result, token) {
    // A renderer may have delayed callbacks (timers, reveal animations, etc.).
    // Only the currently visible experience may commit a result.
    if (token !== activeExperienceToken) return false;
    if (committedExperienceToken === token) return false;
    committedExperienceToken = token;

    // An answer is only recorded after the user has actually committed a choice.
    // Merely entering/seeing an experience never updates answeredIds.
    Storage.markAnswered(item.id);

    Storage.updateStats(stats => {
      stats.answered += 1;
      Scoring.recordMode(stats, item.mode);
      Scoring.recordCategory(stats, item.category);
      Scoring.recordActiveDay(stats);

      if (result.success !== null && result.success !== undefined) {
        Scoring.bumpStreak(stats, result.success);
      }

      switch (item.mode) {
        case 'pick_one': stats.pickOneCount += 1; break;
        case 'scenario': stats.scenarioCount += 1; break;
        case 'knowledge':
          stats.totalKnowledge += 1;
          if (result.success) stats.correctKnowledge += 1;
          break;
        case 'majority':
          stats.majorityTotal += 1;
          break;
        case 'estimation':
          stats.estimationTotal += 1;
          if (typeof result.pctOff === 'number') {
            if (stats.closestEstimatePct === null || result.pctOff < stats.closestEstimatePct) {
              stats.closestEstimatePct = result.pctOff;
            }
          }
          break;
        case 'prediction': stats.predictionCount += 1; break;
        case 'random': stats.randomCount += 1; break;
        case 'brain':
          stats.brainCount += 1;
          if (Number.isFinite(Number(result.scoreValue))) stats.brainBestScore = Math.max(stats.brainBestScore || 0, Number(result.scoreValue));
          break;
      }
    });

    if (item.mode === 'prediction' && typeof Predictions !== 'undefined') {
      const savedPrediction = Predictions.save(item, result);
      if (!savedPrediction) console.warn('[BETWEEN] prediction result was not saved', item.id);
    }

    Storage.addHistory({ id: item.id, mode: item.mode, category: item.category, ts: Date.now(), success: result.success });

    // Library completion is based on answered unique experiences, not merely shown/seen items.
    if (!Storage.getLibraryComplete()) {
      const archive = new Set(Engine.ARCHIVED_MODES || []);
      const playableLibrary = Engine.ITEMS.filter(i => i.mode !== 'brain' && !archive.has(i.mode));
      const uniqueAnswered = Storage.getProgress().answeredIds.filter(id => { const i = Engine.getItem(id); return i && i.mode !== 'brain' && !archive.has(i.mode); }).length;
      if (uniqueAnswered >= playableLibrary.length) {
        Storage.markLibraryComplete();
        setTimeout(() => Screens.libraryCompleteMoment(), 180);
      }
    }

    if (result.chosenText) {
      Tendency.record(item, result.chosenText);
    }

    if (!Storage.getBrandEasterEggSeen() && Math.random() < 0.000002) {
      Storage.markBrandEasterEggSeen();
      setTimeout(() => Screens.brandEasterEgg(), 180);
    }

    // Reveal the "save" affordance now that there's something to save.
    const saveBtn = document.getElementById('btn-save-moment');
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.onclick = () => Screens.openSaveSheet(item, result, saveBtn);
    }

    const session = Storage.getSession();
    if (session && session.currentItemId === item.id) {
      session.round.results.push({ mode: item.mode, success: result.success });
      Storage.setSession(session);
    }
    return true;
  }

  // ---------------- Advance ----------------
  function advanceExperience(token) {
    if (token !== activeExperienceToken) return false;
    // Consume the current experience token before doing anything asynchronous.
    activeExperienceToken = null;
    committedExperienceToken = null;
    if (singleFlow) {
      if (singleFlow.dailyKey) {
        Engine.markDailyDone(singleFlow.dailyDateKey, singleFlow.dailyKey);
      }
      const returnTo = singleFlow.returnTo || 'home';
      singleFlow = null;
      // Replace, don't push: the "experience" history entry collapses back
      // into the tab we return to, rather than stacking another entry.
      pushHistory({ screen: returnTo }, true);
      renderTabScreen(returnTo, true);
      return;
    }

    let session = Storage.getSession();
    if (!session) { navigate('home'); return; }

    if (session.round.count >= ROUND_LENGTH || (session.type === 'pack' && session.round.count >= session.packItems.length)) {
      finishRound(session);
      return;
    }

    const nextItem = pickForSession(session);
    if (!nextItem) { finishRound(session); return; }

    Engine.recordShown(nextItem);
    session.round.count += 1;
    session.currentItemId = nextItem.id;
    session.currentIsMystery = session.type === 'mystery';
    Storage.setSession(session);
    renderExperience(nextItem, session);
  }

  function finishRound(session) {
    const results = session.round.results;
    const graded = results.filter(r => r.success !== null && r.success !== undefined);
    const correct = graded.filter(r => r.success === true).length;
    const accuracy = graded.length ? Math.round((correct / graded.length) * 100) : null;

    let longest = 0, cur = 0;
    graded.forEach(r => {
      if (r.success) { cur += 1; longest = Math.max(longest, cur); } else { cur = 0; }
    });

    const modesPlayed = new Set(results.map(r => r.mode)).size;

    Storage.updateStats(stats => { stats.totalSessions += 1; });
    Storage.clearSession();

    safeRender(() => {
      Screens.sessionEnd(root(), {
        count: results.length,
        accuracy, longestStreak: longest, modesPlayed,
        repeatOpts: { type: session.type, mode: session.mode, packItems: session.packItems },
      });
    }, 'sessionEnd');
  }

  // ---------------- PWA install ----------------
  function isStandalone() { return Capabilities && Capabilities.isStandalone; }

  function canShowInstallNudge() {
    const p = Storage.getProgress();
    return !!deferredInstallPrompt && !isStandalone() && Storage.getStats().answered >= 3 && p.installNudgeDismissed !== true;
  }

  function dismissInstallNudge() { Storage.updateProgress(p => { p.installNudgeDismissed = true; }); }

  function promptInstall() {
    if (deferredInstallPrompt) {
      deferredInstallPrompt.prompt();
      deferredInstallPrompt.userChoice.finally(() => { deferredInstallPrompt = null; });
    } else {
      Screens.toast('Use your browser\u2019s "Add to Home Screen" option.');
    }
  }

  function registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js').catch(err => {
          console.warn('SW registration failed', err);
        });
      });
      // When a new service worker takes control (i.e. a fresh deploy was picked
      // up), let the person know a refresh will get them the latest version —
      // this prevents old, possibly-broken cached JS from lingering silently.
      let refreshed = false;
      const hadServiceWorkerController = !!navigator.serviceWorker.controller;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        // A first install also causes controllerchange when this page is claimed.
        // Only call that an update when this tab was already controlled.
        if (!hadServiceWorkerController || refreshed) return;
        refreshed = true;
        Screens.toast('Updated \u2014 refresh for the latest version.');
      });
    }
    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      window.__BETWEEN_INSTALL_PROMPT = true;
      window.dispatchEvent(new Event('betweeninstallavailable'));
    });
    window.addEventListener('appinstalled', () => {
      deferredInstallPrompt = null;
      window.__BETWEEN_INSTALL_PROMPT = false;
    });
  }

  // ---------------- Global tactile interaction sound ----------------
  function bindInteractionSound() {
    document.addEventListener('click', (e) => {
      const el = e.target && e.target.closest ? e.target.closest('button, [role=button], .nav-item, .mode-card, .option-card, .big-option, .surprise-card, .continue-card') : null;
      if (!el || el.disabled || el.dataset.noSound === 'true') return;
      if (el.classList.contains('selected') || el.classList.contains('correct') || el.classList.contains('incorrect')) return;
      // Gameplay already chooses success/error sounds itself; don't layer a tap over them.
      if (el.matches('.option-card.correct, .option-card.incorrect, .big-option.selected')) return;
      Utils.tone('tap');
    }, { passive: true });
  }

  // ---------------- Keyboard shortcuts (optional, non-mandatory) ----------------
  function bindKeyboard() {
    document.addEventListener('keydown', (e) => {
      if (e.target && ['INPUT', 'TEXTAREA'].includes(e.target.tagName)) {
        if (e.key === 'Enter') {
          const lockBtn = document.querySelector('#btn-lock:not([disabled]), #btn-lock2:not([disabled])');
          if (lockBtn) lockBtn.click();
        }
        return;
      }
      if (e.key === 'Escape') {
        const backBtn = document.querySelector('#btn-back');
        if (backBtn) backBtn.click();
      } else if (e.key === 'Enter') {
        const nextBtn = document.querySelector('#btn-next');
        if (nextBtn) nextBtn.click();
      } else if (['1', '2', '3', '4'].includes(e.key)) {
        const idx = Number(e.key) - 1;
        const opts = document.querySelectorAll('.big-option:not([disabled]), .option-card:not([disabled])');
        if (opts[idx]) opts[idx].click();
      }
    });
  }

  // ---------------- Content self-test (runs at boot; also exposed for QA) ----------------
  function runContentAudit() {
    const report = { itemCount: 0, dupIds: 0, dupPrompts: 0, missingFields: 0, byModeIssues: {} };
    try {
      const items = Engine.ITEMS;
      const ids = new Set();
      const contentSignatures = new Set();
      report.itemCount = items.length;
      items.forEach(i => {
        if (ids.has(i.id)) report.dupIds++; ids.add(i.id);
        const signature = JSON.stringify({ mode:i.mode, prompt:i.prompt, options:Array.isArray(i.options)?i.options:[], answer_index:i.answer_index ?? null, answer:i.answer ?? null });
        if (contentSignatures.has(signature)) report.dupPrompts++; contentSignatures.add(signature);
        if (!i.id || !i.mode || !i.category || !i.prompt) report.missingFields++;

        const flag = (msg) => {
          report.byModeIssues[i.mode] = report.byModeIssues[i.mode] || [];
          report.byModeIssues[i.mode].push(`${i.id}: ${msg}`);
        };
        if (i.mode === 'pick_one' && (!i.options || i.options.length !== 2)) {
          flag('Pick One expects exactly 2 options');
        }
        if (i.mode === 'majority' && (!i.options || i.options.length < 2)) {
          flag('Archived Majority expects at least 2 options');
        }
        if (i.mode === 'knowledge') {
          if (!Array.isArray(i.options) || i.options.length !== 4) flag('expected 4 MCQ options');
          else if (new Set(i.options).size !== 4) flag('duplicate options');
          else if (i.options[i.answer_index] !== i.answer) flag('answer_index does not match answer');
        }
        if (i.mode === 'scenario' && (!i.options || i.options.length < 2)) flag('Scenario expects at least 2 options');
        if (i.mode === 'estimation') {
          const hasNumeric = Number.isFinite(i.target) || (Number.isFinite(i.target_min) && Number.isFinite(i.target_max));
          if (!i.answer_display || !i.estimate_kind) flag('missing estimation answer data');
          // Unit is optional: some source questions state the unit intrinsically in the prompt/answer.
        }
        if (i.mode === 'brain') {
          const supportedBrainTypes = typeof BrainConfig !== 'undefined' ? new Set(BrainConfig.experiences.map(x => x.type)) : new Set();
          if (!i.brain_type) flag('missing brain_type (Brain entries must declare a player-facing experience)');
          else if (!supportedBrainTypes.has(i.brain_type)) flag(`unsupported brain_type "${i.brain_type}"`);
          if (!i.title) flag('missing Brain title');
          if (i.brain_type !== 'final_boss' && typeof BrainGenerators !== 'undefined' && !BrainConfig.engineTypes.includes(i.brain_type)) flag(`Brain type has no generator: ${i.brain_type}`);
        }
        if (i.mode === 'prediction' || i.mode === 'random') {
          const shape = i[`${i.mode}_shape`] || (Array.isArray(i.options) ? (i.options.length > 2 ? 'list' : 'binary') : 'open');
          const supportedShapes = i.mode === 'prediction'
            ? ['binary', 'yesno', 'list', 'freetext', 'open', 'numeric']
            : ['binary', 'yesno', 'list', 'freetext', 'open', 'reflection'];
          if (!supportedShapes.includes(shape)) flag(`unsupported ${i.mode} shape "${shape}"`);
          if ((shape === 'binary' || shape === 'yesno') && (!Array.isArray(i.options) || i.options.length !== 2)) flag(`${i.mode} ${shape} expects 2 options`);
          if (shape === 'list' && (!Array.isArray(i.options) || i.options.length < 3)) flag(`${i.mode} list expects 3+ options`);
          if (i.mode === 'prediction' && shape === 'numeric' && i.prompt && !/\bhow many\b|\bhow long\b|\bhow much\b/i.test(i.prompt)) flag('numeric prediction should declare a numeric quantity');
        }
      });
      console.info(`[BETWEEN self-test] items=${report.itemCount} dupIds=${report.dupIds} dupPrompts=${report.dupPrompts} missingFields=${report.missingFields}`);
      const issueCount = Object.values(report.byModeIssues).reduce((a, arr) => a + arr.length, 0);
      if (issueCount) console.warn('[BETWEEN self-test] content issues:', report.byModeIssues);
      else console.info('[BETWEEN self-test] no structural content issues found');
    } catch (e) {
      console.warn('[BETWEEN self-test] failed', e);
      report.error = String(e);
    }
    window.BETWEEN_QA_REPORT = report;
    return report;
  }

  // ---------------- Boot ----------------
  function getInitialScreen() {
    const hash = String(location.hash || '').replace(/^#/, '').trim();
    const allowed = new Set(TAB_SCREENS);
    return allowed.has(hash) ? hash : 'home';
  }

  function dismissBoot(boot) {
    if (!boot) return;
    boot.style.opacity = '0';
    setTimeout(() => { if (boot && boot.parentNode) boot.remove(); }, 180);
  }

  function showFatalBootError(error) {
    console.error('[BETWEEN] startup failed', error);
    if (window.__BETWEEN_BOOT_GUARD && typeof window.__BETWEEN_BOOT_GUARD.fail === 'function') {
      window.__BETWEEN_BOOT_GUARD.fail('app initialization error');
      return;
    }
    const boot = document.getElementById('boot-screen');
    const appRoot = root();
    if (!appRoot) return;
    if (boot) boot.remove();
    appRoot.innerHTML = `
      <div class="screen">
        <div class="empty-state" data-error-state>
          <div style="font-weight:800;font-size:17px;color:var(--text);margin-bottom:6px;">BETWEEN couldn’t start.</div>
          <div style="margin-bottom:20px;">Your saved progress is still on this device. Try again to restart the app.</div>
          <button class="btn btn-primary" id="btn-start-retry">Try again</button>
        </div>
      </div>`;
    const retry = appRoot.querySelector('#btn-start-retry');
    if (retry) retry.onclick = () => location.reload();
  }

  function init() {
    try {
      runContentAudit();
      registerServiceWorker();
      bindKeyboard();
      bindInteractionSound();
      const params = new URLSearchParams(location.search);
      const duelToken = params.get('duel');
      if (duelToken) { window.__BETWEEN_DUEL_TOKEN = duelToken; history.replaceState({screen:'duel'}, '', location.pathname + '#duel'); }
      const packToken = params.get('pack');
      if (packToken) {
        const pack = Packs.decode(packToken);
        if (pack) {
          Packs.save(pack);
          history.replaceState({screen:'packs'}, '', location.pathname + '#packs');
          window.__BETWEEN_IMPORTED_PACK = pack.title;
        }
      }

      // Last-resort net: catch anything that slips past individual render try/catches.
      window.addEventListener('error', () => {
        if (!document.querySelector('.empty-state[data-error-state]')) {
          safeRender(() => { throw new Error('uncaught'); }, 'window.onerror');
        }
      });

      const boot = document.getElementById('boot-screen');
      const initialScreen = getInitialScreen();
      pushHistory({ screen: initialScreen }, true);
      renderTabScreen(initialScreen, true);
      // Never leave the boot screen covering a successfully rendered app.
      if (window.__BETWEEN_BOOT_GUARD && typeof window.__BETWEEN_BOOT_GUARD.complete === 'function') {
        window.__BETWEEN_BOOT_GUARD.complete();
      } else {
        dismissBoot(boot);
      }
    } catch (error) {
      showFatalBootError(error);
    }
  }

  return {
    init, navigate, back,
    beginSession, resumeSession, startSingle,
    exitExperience, handleResult, handleBrainRun, advanceExperience,
    promptInstall, canShowInstallNudge, dismissInstallNudge, runContentAudit, openCapsule, startPassThePhone, reportItem,
  };
})();

document.addEventListener('DOMContentLoaded', App.init);

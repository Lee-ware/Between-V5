// ===================== MODE RENDERERS =====================
// Each render(container, item, ctx) draws the question UI into container.
// ctx = {
//   isMystery: bool,
//   reportResult(result): call ONCE when the answer is locked in.
//     result = { success: true|false|null, label, sub, deltaLabel }
//   next(): call when the user taps the Next / Continue button.
// }

const Modes = (() => {

  const REFLECTIONS = [
    "There's no single right call here — it just shows how you weigh things.",
    "Different people land in different places on this one.",
    "That says something about how you handle pressure.",
    "Reasonable people disagree on this constantly.",
    "That's a values call more than a right-or-wrong one.",
  ];

  function mysteryPrefix(ctx, item) {
    if (!ctx.isMystery) return '';
    const meta = Engine.MODE_META[item.mode];
    return `<div class="exp-hint" style="margin-bottom:14px;">✨ That was <b>${meta.label}</b>.</div>`;
  }

  function nextButtonHTML(label = 'Next') {
    return `
      <div class="next-cta">
        <button class="btn btn-primary" id="btn-next" data-icon-right="next">${label} →</button>
      </div>`;
  }

  function bindNext(container, ctx) {
    const btn = container.querySelector('#btn-next');
    if (btn) btn.addEventListener('click', () => ctx.next());
  }

  function vibrate(ms, kind='tap') { if (navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) {} } Utils.tone(kind); }

  // ---------------------------------------------------------------
  // PICK ONE
  // ---------------------------------------------------------------
  function renderPickOne(container, item, ctx) {
    const opts = (item.options && item.options.length === 2) ? item.options : ['Option A', 'Option B'];

    container.innerHTML = `
      <div class="exp-body">
        <div class="exp-category">${Utils.escapeHtml(item.category)}</div>
        <div class="exp-question">${Utils.escapeHtml(item.prompt)}</div>
        <div class="two-up" id="opts">
          <button class="big-option" data-i="0">${Utils.escapeHtml(opts[0])}</button>
          <div class="or-divider">or</div>
          <button class="big-option" data-i="1">${Utils.escapeHtml(opts[1])}</button>
        </div>
        <div id="reveal-slot"></div>
      </div>
    `;

    container.querySelectorAll('.big-option').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.big-option').forEach(b => b.disabled = true);
        btn.classList.add('selected', 'pulse');
        vibrate(12);

        const chosenText = opts[Number(btn.dataset.i)];
        ctx.reportResult({ success: null, label: 'Choice made.', chosenText, item });

        // Pick One is deliberately frictionless: the tap is the commitment,
        // so there is no redundant "Locked in" / "Next" step.
        setTimeout(() => ctx.next(), 120);
      });
    });
  }

  // ---------------------------------------------------------------
  // KNOWLEDGE — real multiple-choice with generated-but-plausible distractors
  // ---------------------------------------------------------------
  function renderKnowledge(container, item, ctx) {
    const letters = ['A', 'B', 'C', 'D'];
    const hasOptions = Array.isArray(item.options) && item.options.length === 4 && Number.isInteger(item.answer_index);

    if (!hasOptions) {
      // Defensive fallback for any malformed/legacy item — flashcard self-report.
      renderKnowledgeFlashcardFallback(container, item, ctx);
      return;
    }

    container.innerHTML = `
      <div class="exp-body">
        <div class="exp-category">${Utils.escapeHtml(item.category)} · Knowledge</div>
        <div class="exp-question">${Utils.escapeHtml(item.prompt)}</div>
        <div class="options-stack" id="opts">
          ${item.options.map((opt, i) => `
            <button class="option-card" data-i="${i}">
              <span class="opt-letter">${letters[i]}</span>${Utils.escapeHtml(opt)}
            </button>`).join('')}
        </div>
        <div id="reveal-slot"></div>
      </div>
    `;

    container.querySelectorAll('.option-card').forEach(btn => {
      btn.addEventListener('click', () => {
        const chosenIdx = Number(btn.dataset.i);
        const success = chosenIdx === item.answer_index;
        container.querySelectorAll('.option-card').forEach(b => {
          b.disabled = true;
          const idx = Number(b.dataset.i);
          if (idx === item.answer_index) b.classList.add('correct');
          else if (idx === chosenIdx) b.classList.add('incorrect');
          else b.classList.add('dim');
        });
        vibrate(success ? 14 : 8, success ? 'success' : 'error');

        ctx.reportResult({
          success,
          label: success ? 'Correct' : 'Not quite',
          deltaLabel: success ? '+100' : null,
        });

        setTimeout(() => {
          const slot = container.querySelector('#reveal-slot');
          slot.innerHTML = `
            ${mysteryPrefix(ctx, item)}
            <div class="reveal-card ${success ? 'pulse' : ''}">
              <div class="reveal-answer" style="font-size:22px; color:${success ? '#17e0b0' : '#ff5c72'}">
                ${success ? 'Correct' : 'Not quite'}
              </div>
              <div class="reveal-sub" style="margin-top:8px;">Answer: <b style="color:var(--text)">${Utils.escapeHtml(item.answer)}</b></div>
              ${item.explanation ? `<div class="reveal-sub" style="margin-top:8px; line-height:1.55;">${Utils.escapeHtml(item.explanation)}</div>` : ''}
            </div>
            ${nextButtonHTML()}
          `;
          bindNext(container, ctx);
        }, 320);
      });
    });
  }

  // Legacy fallback (kept for resilience against malformed content only — not used by the shipped dataset).
  function renderKnowledgeFlashcardFallback(container, item, ctx) {
    container.innerHTML = `
      <div class="exp-body">
        <div class="exp-category">${Utils.escapeHtml(item.category)} · Knowledge</div>
        <div class="exp-question">${Utils.escapeHtml(item.prompt)}</div>
        <div class="exp-hint">Think of your answer, then reveal.</div>
        <div style="margin-top:30px;">
          <button class="btn btn-primary" id="btn-reveal">Reveal answer</button>
        </div>
        <div id="reveal-slot"></div>
      </div>
    `;
    container.querySelector('#btn-reveal').addEventListener('click', () => {
      const slot = container.querySelector('#reveal-slot');
      slot.innerHTML = `
        <div class="reveal-card pulse">
          <div class="reveal-sub" style="margin-bottom:6px;">The answer is</div>
          <div class="reveal-answer">${Utils.escapeHtml(item.answer)}</div>
        </div>
        <div class="self-report-row">
          <button class="btn btn-ghost" id="btn-wrong">I got it wrong</button>
          <button class="btn btn-primary" id="btn-right">I got it right</button>
        </div>
        <div id="after-slot"></div>
      `;
      container.querySelector('#btn-reveal').remove();
      const finish = (success) => {
        container.querySelector('#btn-right').disabled = true;
        container.querySelector('#btn-wrong').disabled = true;
        ctx.reportResult({ success, label: success ? 'Correct' : 'Not quite', deltaLabel: success ? '+100' : null });
        container.querySelector('#after-slot').innerHTML = `${mysteryPrefix(ctx, item)}${nextButtonHTML()}`;
        bindNext(container, ctx);
      };
      container.querySelector('#btn-right').addEventListener('click', () => finish(true));
      container.querySelector('#btn-wrong').addEventListener('click', () => finish(false));
    });
  }

  // ---------------------------------------------------------------
  // SCENARIO
  // ---------------------------------------------------------------
  const SCENARIO_REFLECTIONS = [
    "That choice leans practical — get the facts, then act.",
    "That choice leans emotional — people matter more than process to you.",
    "That's a cautious move. Not wrong, just careful.",
    "That's a bold move. It says you trust your gut.",
    "Interesting — that's not the most common first instinct.",
  ];

  function renderScenario(container, item, ctx) {
    const letters = ['A', 'B', 'C', 'D', 'E'];
    container.innerHTML = `
      <div class="exp-body">
        <div class="exp-category" style="color:var(--c-scenario)">THE SITUATION</div>
        ${item.title ? `<div class="section-title" style="font-size:22px; margin:4px 0 14px; color:var(--text);">${Utils.escapeHtml(item.title)}</div>` : ''}
        <div class="exp-question small">${Utils.escapeHtml(item.prompt)}</div>
        <div class="options-stack" id="opts">
          ${item.options.map((opt, i) => `
            <button class="option-card" data-i="${i}">
              <span class="opt-letter">${letters[i]}</span>${Utils.escapeHtml(opt)}
            </button>`).join('')}
        </div>
        <div id="reveal-slot"></div>
      </div>
    `;

    container.querySelectorAll('.option-card').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.option-card').forEach(b => {
          b.disabled = true;
          if (b !== btn) b.classList.add('dim');
        });
        btn.classList.add('selected');
        vibrate(12);

        const chosen = item.options[Number(btn.dataset.i)];
        ctx.reportResult({ success: null, label: 'Choice locked.', chosenText: chosen, item });

        setTimeout(() => {
          const slot = container.querySelector('#reveal-slot');
          slot.innerHTML = `
            ${mysteryPrefix(ctx, item)}
            <div class="reveal-card">
              <div class="reveal-sub" style="margin-bottom:6px;">Choice locked.</div>
              <div class="reveal-sub">${Utils.pick(SCENARIO_REFLECTIONS)}</div>
            </div>
            ${nextButtonHTML()}
          `;
          bindNext(container, ctx);
        }, 260);
      });
    });
  }

  // ---------------------------------------------------------------
  // MAJORITY
  // ---------------------------------------------------------------
  function renderMajority(container, item, ctx) {
    const opts = (item.options && item.options.length === 2) ? item.options : ['Option A', 'Option B'];

    container.innerHTML = `
      <div class="exp-body">
        <div class="exp-category" style="color:var(--c-majority)">What would most people choose?</div>
        <div class="exp-question small">${Utils.escapeHtml(opts[0])} <span style="color:var(--text-mute)">or</span> ${Utils.escapeHtml(opts[1])}?</div>
        <div class="two-up" id="opts">
          <button class="big-option" data-i="0">${Utils.escapeHtml(opts[0])}</button>
          <div class="or-divider">or</div>
          <button class="big-option" data-i="1">${Utils.escapeHtml(opts[1])}</button>
        </div>
        <div id="reveal-slot"></div>
      </div>
    `;

    container.querySelectorAll('.big-option').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.big-option').forEach(b => b.disabled = true);
        btn.classList.add('selected', 'pulse');
        vibrate(12);
        const chosenText = opts[Number(btn.dataset.i)];

        ctx.reportResult({ success: null, label: 'Locked in.', chosenText, item });

        setTimeout(() => {
          const slot = container.querySelector('#reveal-slot');
          slot.innerHTML = `
            ${mysteryPrefix(ctx, item)}
            <div class="reveal-card">
              <div class="reveal-sub" style="margin-bottom:6px;">Locked in. You predicted</div>
              <div class="reveal-answer" style="font-size:20px;">${Utils.escapeHtml(chosenText)}</div>
              <div class="reveal-sub" id="crowd-status" style="margin-top:14px;">Checking what everyone else picked\u2026</div>
            </div>
            ${nextButtonHTML()}
          `;
          bindNext(container, ctx);

          // Real crowd data, if the optional server component is deployed and
          // reachable — otherwise this resolves to null and we say so honestly.
          // This never delays or blocks the Next button above.
          Crowd.voteAndFetch(item, chosenText).then(summary => {
            const statusEl = container.querySelector('#crowd-status');
            if (!statusEl) return; // user already moved on

            if (summary.status === 'unavailable') {
              statusEl.innerHTML = `\u{1F512} Crowd data unavailable right now \u2014 your prediction was still saved to your stats.`;
              return;
            }
            if (summary.status === 'insufficient') {
              statusEl.innerHTML = `\u{1F31F} Only ${summary.total} ${summary.total === 1 ? 'person has' : 'people have'} answered this one so far \u2014 not enough yet for a real percentage.`;
              return;
            }
            const youMatched = summary.topOption === chosenText;
            const sampleNote = summary.smallSample
              ? ` <span style="color:var(--text-mute);">(small sample so far \u2014 ${summary.total} answers)</span>`
              : ` <span style="color:var(--text-mute);">(${summary.total} answers)</span>`;
            statusEl.innerHTML = `
              \u{1F30D} ${summary.pct}% chose "${Utils.escapeHtml(summary.topOption)}"${sampleNote}<br/>
              <span style="font-weight:800; color:${youMatched ? 'var(--c-knowledge)' : 'var(--text)'};">
                ${youMatched ? 'You predicted the majority.' : 'You went against the majority.'}
              </span>
            `;
          });
        }, 260);
      });
    });
  }

  // ---------------------------------------------------------------
  // ESTIMATION — distance/accuracy score, never punished harshly
  // ---------------------------------------------------------------
  function renderEstimation(container, item, ctx) {
    const numeric = item.estimate_kind === 'numeric' && (item.target_kind !== 'text');
    if (!numeric) {
      renderFreetext(container, item, ctx, 'var(--c-estimation)', `${Utils.escapeHtml(item.category)} · Estimation`);
      return;
    }

    container.innerHTML = `
      <div class="exp-body">
        <div class="exp-category">${Utils.escapeHtml(item.category)} · Estimation</div>
        <div class="exp-question">${Utils.escapeHtml(item.prompt)}</div>
        <div class="estimate-input-wrap">
          <input type="number" inputmode="decimal" class="estimate-input" id="est-input" placeholder="Your guess" />
          <div class="estimate-unit">${item.unit ? 'in ' + Utils.escapeHtml(item.unit) : ''}</div>
        </div>
        <div style="margin-top:22px;">
          <button class="btn btn-primary" id="btn-lock" disabled>Lock it in</button>
        </div>
        <div id="reveal-slot"></div>
      </div>
    `;

    const input = container.querySelector('#est-input');
    const lockBtn = container.querySelector('#btn-lock');
    input.addEventListener('input', () => { lockBtn.disabled = input.value.trim() === ''; });
    input.focus();

    lockBtn.addEventListener('click', () => {
      const guess = Number(input.value);
      if (!Number.isFinite(guess)) return;
      input.disabled = true;
      lockBtn.disabled = true;

      const result = Scoring.estimationAccuracyForItem(guess, item);
      const feedback = Scoring.estimationFeedback(result.pctOff);
      // Estimation never produces a punitive "wrong" — only a distance/accuracy score.
      const success = result.pctOff <= 30 ? true : (result.pctOff > 100 ? false : null);

      ctx.reportResult({ success, label: feedback, deltaLabel: `${result.score} pts`, pctOff: result.pctOff });

      const actualDisplay = item.answer_display || (Number.isFinite(item.target) ? `${Utils.fmtNum(item.target)} ${item.unit || ''}` : 'See the source answer.');
      const offDisplay = result.withinRange ? 'Inside the source range · 100/100' : `${result.pctOff < 1000 ? result.pctOff.toFixed(1) : Utils.fmtNum(Math.round(result.pctOff))}% off · ${result.score}/100`;
      const slot = container.querySelector('#reveal-slot');
      slot.innerHTML = `
        ${mysteryPrefix(ctx, item)}
        <div class="reveal-card pulse">
          <div class="reveal-sub">Your guess: <b style="color:var(--text)">${Utils.fmtNum(guess)} ${Utils.escapeHtml(item.unit || '')}</b></div>
          <div class="reveal-sub" style="margin-top:6px;">Actual: <b style="color:var(--text)">${Utils.escapeHtml(actualDisplay)}</b></div>
          <div class="reveal-answer" style="margin-top:10px;font-size:22px;">${Utils.escapeHtml(offDisplay)}</div>
          <div class="reveal-sub" style="margin-top:6px;">${Utils.escapeHtml(feedback)}</div>
        </div>
        ${nextButtonHTML()}
      `;
      bindNext(container, ctx);
    });
  }

  // ---------------------------------------------------------------
  // Shared: freetext reflection input (no scoring, no fake correctness)
  // ---------------------------------------------------------------
  function renderFreetext(container, item, ctx, accentVar, categoryLabel) {
    container.innerHTML = `
      <div class="exp-body">
        <div class="exp-category" style="color:${accentVar}">${categoryLabel}</div>
        <div class="exp-question small">${Utils.escapeHtml(item.prompt)}</div>
        <div class="estimate-input-wrap">
          <input type="text" maxlength="140" class="estimate-input" id="ft-input"
                 style="font-size:17px; text-align:left;" placeholder="Type your answer…" />
        </div>
        <div style="margin-top:22px;">
          <button class="btn btn-primary" id="btn-lock" disabled>Lock it in</button>
        </div>
        <div id="reveal-slot"></div>
      </div>
    `;
    const input = container.querySelector('#ft-input');
    const lockBtn = container.querySelector('#btn-lock');
    input.addEventListener('input', () => { lockBtn.disabled = input.value.trim() === ''; });
    input.focus();

    lockBtn.addEventListener('click', () => {
      const text = input.value.trim();
      input.disabled = true;
      lockBtn.disabled = true;
      ctx.reportResult({ success: null, label: 'Noted.', freetext: text });
      const slot = container.querySelector('#reveal-slot');
      slot.innerHTML = `
        ${mysteryPrefix(ctx, item)}
        <div class="reveal-card">
          <div class="reveal-sub" style="margin-bottom:6px;">You wrote</div>
          <div class="reveal-answer" style="font-size:18px;">“${Utils.escapeHtml(text)}”</div>
        </div>
        ${nextButtonHTML()}
      `;
      bindNext(container, ctx);
    });
  }

  // ---------------------------------------------------------------
  // PREDICTION — uses explicit prediction_shape from the content schema.
  // "Prediction locked." per spec; never fabricates a checkable outcome.
  // ---------------------------------------------------------------
  function renderPrediction(container, item, ctx) {
    const shape = item.prediction_shape || (item.options ? (item.options.length > 2 ? 'list' : 'binary') : 'open');

    if (shape === 'freetext') {
      renderFreetext(container, item, ctx, 'var(--c-prediction)', `${Utils.escapeHtml(item.category)} · Prediction`);
      return;
    }

    const finishWith = (chosenLabel) => {
      ctx.reportResult({ success: null, label: 'Prediction locked.', chosenText: chosenLabel, item });
      const slot = container.querySelector('#reveal-slot');
      slot.innerHTML = `
        ${mysteryPrefix(ctx, item)}
        <div class="reveal-card">
          <div class="reveal-sub" style="margin-bottom:6px;">Prediction locked.</div>
          <div class="reveal-answer" style="font-size:20px;">${Utils.escapeHtml(chosenLabel)}</div>
          <div class="reveal-sub" style="margin-top:10px;">We'll see how that ages.</div>
        </div>
        ${nextButtonHTML()}
      `;
      bindNext(container, ctx);
    };

    if (shape === 'numeric') {
      container.innerHTML = `
        <div class="exp-body">
          <div class="exp-category" style="color:var(--c-prediction)">${Utils.escapeHtml(item.category)} · Prediction</div>
          <div class="exp-question small">${Utils.escapeHtml(item.prompt)}</div>
          <div class="estimate-input-wrap">
            <input type="number" inputmode="numeric" step="1" min="0" class="estimate-input" id="prediction-input" placeholder="Your prediction" />
          </div>
          ${item.resolution_window ? `<div class="exp-hint" style="margin-top:12px;">Resolution window: ${Utils.escapeHtml(item.resolution_window)}</div>` : ''}
          <div style="margin-top:22px;">
            <button class="btn btn-primary" id="btn-prediction-lock" disabled>Lock it in</button>
          </div>
          <div id="reveal-slot"></div>
        </div>`;
      const input = container.querySelector('#prediction-input');
      const btn = container.querySelector('#btn-prediction-lock');
      input.addEventListener('input', () => {
        const value = Number(input.value);
        btn.disabled = input.value.trim() === '' || !Number.isFinite(value) || value < 0 || !Number.isInteger(value);
      });
      input.focus();
      btn.addEventListener('click', () => {
        const value = Number(input.value);
        if (!Number.isInteger(value) || value < 0) return;
        input.disabled = true;
        btn.disabled = true;
        ctx.reportResult({ success: null, label: 'Prediction locked.', predictionValue: value, item });
        const slot = container.querySelector('#reveal-slot');
        slot.innerHTML = `
          ${mysteryPrefix(ctx, item)}
          <div class="reveal-card">
            <div class="reveal-sub" style="margin-bottom:6px;">Prediction locked.</div>
            <div class="reveal-answer" style="font-size:20px;">${Utils.fmtNum(value)}</div>
            ${item.resolution_window ? `<div class="reveal-sub" style="margin-top:10px;">Check back after ${Utils.escapeHtml(item.resolution_window.toLowerCase())}.</div>` : `<div class="reveal-sub" style="margin-top:10px;">Check back when the prediction has a real answer.</div>`}
          </div>
          ${nextButtonHTML()}
        `;
        bindNext(container, ctx);
      });
      return;
    }

    if (shape === 'binary' || shape === 'yesno') {
      const opts = item.options && item.options.length === 2 ? item.options : ['Yes', 'No'];
      container.innerHTML = `
        <div class="exp-body">
          <div class="exp-category" style="color:var(--c-prediction)">${Utils.escapeHtml(item.category)} · Prediction</div>
          <div class="exp-question small">${Utils.escapeHtml(item.prompt)}</div>
          <div class="two-up" id="opts">
            <button class="big-option" data-i="0">${Utils.escapeHtml(opts[0])}</button>
            <div class="or-divider">or</div>
            <button class="big-option" data-i="1">${Utils.escapeHtml(opts[1])}</button>
          </div>
          <div id="reveal-slot"></div>
        </div>`;
      container.querySelectorAll('.big-option').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.big-option').forEach(b => b.disabled = true);
          btn.classList.add('selected', 'pulse');
          finishWith(opts[Number(btn.dataset.i)]);
        });
      });
      return;
    }

    if (shape === 'list' && item.options) {
      container.innerHTML = `
        <div class="exp-body">
          <div class="exp-category" style="color:var(--c-prediction)">${Utils.escapeHtml(item.category)} · Prediction</div>
          <div class="exp-question small">${Utils.escapeHtml(item.prompt)}</div>
          <div class="options-stack" id="opts">
            ${item.options.map((opt, i) => `<button class="option-card" data-i="${i}">${Utils.escapeHtml(opt)}</button>`).join('')}
          </div>
          <div id="reveal-slot"></div>
        </div>`;
      container.querySelectorAll('.option-card').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.option-card').forEach(b => { b.disabled = true; if (b !== btn) b.classList.add('dim'); });
          btn.classList.add('selected');
          finishWith(item.options[Number(btn.dataset.i)]);
        });
      });
      return;
    }

    // Open reflective prediction — no clean checkable shape, just a beat of reflection.
    container.innerHTML = `
      <div class="exp-body">
        <div class="exp-category" style="color:var(--c-prediction)">${Utils.escapeHtml(item.category)} · Prediction</div>
        <div class="exp-question small">${Utils.escapeHtml(item.prompt)}</div>
        <div class="exp-hint">Hold your answer in your head — then continue.</div>
        <div style="margin-top:28px;">
          <button class="btn btn-primary" id="btn-lock2">Lock it in</button>
        </div>
        <div id="reveal-slot"></div>
      </div>`;
    container.querySelector('#btn-lock2').addEventListener('click', (e) => {
      e.target.remove();
      finishWith('Noted');
    });
  }

  // ---------------------------------------------------------------
  // RANDOM — uses explicit random_shape from the content schema.
  // ---------------------------------------------------------------
  function renderRandom(container, item, ctx) {
    const shape = item.random_shape || (item.options ? (item.options.length > 2 ? 'list' : 'binary') : 'open');

    if (shape === 'freetext') {
      renderFreetext(container, item, ctx, 'var(--c-random)', item.category);
      return;
    }

    const finishOpen = () => {
      ctx.reportResult({ success: null, label: 'Mission logged.' });
      const slot = container.querySelector('#reveal-slot');
      slot.innerHTML = `
        ${mysteryPrefix(ctx, item)}
        <div class="reveal-card">
          <div class="reveal-sub">Nice. Carry that into the next one.</div>
        </div>
        ${nextButtonHTML()}
      `;
      bindNext(container, ctx);
    };
    const finishChoice = (label) => {
      ctx.reportResult({ success: null, label: 'Locked in.', chosenText: label, item });
      const slot = container.querySelector('#reveal-slot');
      slot.innerHTML = `
        ${mysteryPrefix(ctx, item)}
        <div class="reveal-card">
          <div class="reveal-answer" style="font-size:20px;">${Utils.escapeHtml(label)}</div>
        </div>
        ${nextButtonHTML()}
      `;
      bindNext(container, ctx);
    };

    if (shape === 'list' && item.options) {
      container.innerHTML = `
        <div class="exp-body">
          <div class="exp-category" style="color:var(--c-random)">${Utils.escapeHtml(item.category)}</div>
          <div class="exp-question small">${Utils.escapeHtml(item.prompt)}</div>
          <div class="options-stack" id="opts">
            ${item.options.map((opt, i) => `<button class="option-card" data-i="${i}">${Utils.escapeHtml(opt)}</button>`).join('')}
          </div>
          <div id="reveal-slot"></div>
        </div>`;
      container.querySelectorAll('.option-card').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.option-card').forEach(b => { b.disabled = true; if (b !== btn) b.classList.add('dim'); });
          btn.classList.add('selected');
          finishChoice(item.options[Number(btn.dataset.i)]);
        });
      });
      return;
    }

    if ((shape === 'binary' || shape === 'yesno') && item.options) {
      const opts = item.options;
      container.innerHTML = `
        <div class="exp-body">
          <div class="exp-category" style="color:var(--c-random)">${Utils.escapeHtml(item.category)}</div>
          <div class="exp-question small">${Utils.escapeHtml(item.prompt)}</div>
          <div class="two-up" id="opts">
            <button class="big-option" data-i="0">${Utils.escapeHtml(opts[0])}</button>
            <div class="or-divider">or</div>
            <button class="big-option" data-i="1">${Utils.escapeHtml(opts[1])}</button>
          </div>
          <div id="reveal-slot"></div>
        </div>`;
      container.querySelectorAll('.big-option').forEach(btn => {
        btn.addEventListener('click', () => {
          container.querySelectorAll('.big-option').forEach(x => x.disabled = true);
          btn.classList.add('selected', 'pulse');
          finishChoice(opts[Number(btn.dataset.i)]);
        });
      });
      return;
    }

    // Open mission / thought / rule — acknowledge and move on, no fake scoring.
    container.innerHTML = `
      <div class="exp-body">
        <div class="exp-category" style="color:var(--c-random)">${Utils.escapeHtml(item.category)}</div>
        <div class="exp-question small">${Utils.escapeHtml(item.prompt)}</div>
        <div style="margin-top:28px;">
          <button class="btn btn-primary" id="btn-done">Got it</button>
        </div>
        <div id="reveal-slot"></div>
      </div>`;
    container.querySelector('#btn-done').addEventListener('click', (e) => {
      e.target.remove();
      finishOpen();
    });
  }

  // ---------------------------------------------------------------
  // BRAIN — separate procedural BrainEngine. The 20 Brain records are
  // player-facing entry points; the actual challenge rounds are generated
  // at runtime by dedicated engines under js/brain/.
  // ---------------------------------------------------------------
  function renderBrain(container, item, ctx) {
    if (typeof BrainEngine === 'undefined') {
      container.innerHTML = `<div class="reveal-card"><div class="reveal-sub">Brain is unavailable on this cached version.</div></div>${nextButtonHTML('Skip')}`;
      bindNext(container, ctx);
      return;
    }
    BrainEngine.start(container, item, ctx, { daily: !!ctx.isDaily });
  }

  // Central dispatch table. Keep this explicit so every player-facing mode
  // resolves to its renderer before the experience begins.
  const RENDERERS = Object.freeze({
    pick_one: renderPickOne,
    knowledge: renderKnowledge,
    scenario: renderScenario,
    majority: renderMajority,
    estimation: renderEstimation,
    prediction: renderPrediction,
    random: renderRandom,
    brain: renderBrain,
  });

  function render(container, item, ctx) {
    const fn = RENDERERS[item.mode];
    if (!fn) {
      container.innerHTML = `<div class="empty-state">Unsupported mode.</div>`;
      return;
    }
    fn(container, item, ctx);
  }

  return { render };
})();

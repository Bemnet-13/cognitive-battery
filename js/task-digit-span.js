// ── Digit Span Task (SPEC §Task interface) ──
const DigitSpan = {
  id: 'digitSpan',
  label: 'Digit Span',

  _cond: 'forward',
  _isPractice: false,
  _currentLevel: 3,
  _trialsHere: [],
  _allTrials: [],
  _practiceLeft: 2,
  _inputRevealTime: 0,
  _fwdSpan: 0,
  _bwdSpan: 0,
  _onComplete: null,
  _timeoutId: null,
  _schedTimers: [],
  _rng: null,

  _cleanup() {
    if (this._timeoutId) { clearTimeout(this._timeoutId); this._timeoutId = null; }
    for (const t of this._schedTimers) clearTimeout(t);
    this._schedTimers = [];
  },

  showInstructions(onReady) {
    this._onReady = onReady;
    this._renderInstructions('forward');
  },

  run(onComplete) {
    this._reset();
    S.taskActive = true;
    this._onComplete = onComplete;
    this._rng = rng();
    this._showInstructions('forward');
  },

  getCSVRows(results, sessionMeta) {
    const base = { ...sessionMeta };
    return results.trials.map(t => ({ ...base, ...t }));
  },

  renderResults(results, container) {
    const real = results.trials.filter(t => !t.is_practice);
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-val">${results.forwardSpan}</div><div class="stat-label">Forward span</div></div>
        <div class="stat-card"><div class="stat-val">${results.backwardSpan}</div><div class="stat-label">Backward span</div></div>
        <div class="stat-card"><div class="stat-val">${results.rawScore}</div><div class="stat-label">Raw score</div></div>
        <div class="stat-card"><div class="stat-val">${(results.meanRT || 0).toFixed(2)}</div><div class="stat-label">Mean RT (s)</div></div>
      </div>
      <div class="divider"></div>
      <h3 style="margin-bottom:.5rem">Accuracy by span length</h3>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Length</th><th>Condition</th><th>Trials</th><th>Correct</th><th>Accuracy</th></tr></thead>
          <tbody>${this._buildAccuracyRows(real, results.forwardSpan, results.backwardSpan)}</tbody>
        </table>
      </div>
      <div class="divider"></div>
      <h3>Error type analysis</h3>
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-val">${results.errorBreakdown.transposition}</div><div class="stat-label">Transposition</div></div>
        <div class="stat-card"><div class="stat-val">${results.errorBreakdown.substitution}</div><div class="stat-label">Substitution</div></div>
        <div class="stat-card"><div class="stat-val">${results.errorBreakdown.length}</div><div class="stat-label">Length error</div></div>
      </div>
    `;

    // Serial position curve
    if (results.serialPositionCurve) {
      const div = document.createElement('div');
      div.innerHTML = '<div class="divider"></div><h3>Serial position curve</h3><div style="overflow-x:auto"><canvas width="540" height="260" style="width:100%;max-width:540px;height:auto;border-radius:var(--r-sm);display:block;margin:.75rem 0"></canvas></div>';
      container.appendChild(div);
      const canvas = div.querySelector('canvas');
      if (canvas) this._drawSPCurve(results, canvas);
    }
  },

  _drawSPCurve(results, canvas) {
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const M = { t: 30, r: 15, b: 40, l: 50 };
    const cw = W - M.l - M.r, ch = H - M.t - M.b;
    const sp = results.serialPositionCurve;
    if (!sp) return;
    const maxPos = Math.max((sp.forward || []).length, (sp.backward || []).length);
    if (maxPos === 0) return;

    const clr = { forward: '#2448c0', backward: '#b8a020' };
    const labels = { forward: 'Forward', backward: 'Backward' };
    const gap = cw / maxPos;
    const bw = gap * 0.3;

    ctx.clearRect(0, 0, W, H);

    // Grid lines + Y labels
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.font = '10px IBM Plex Mono, monospace';
    for (let p = 0; p <= 100; p += 25) {
      const y = M.t + ch - (p / 100) * ch;
      ctx.strokeStyle = '#f0ede7';
      ctx.beginPath(); ctx.moveTo(M.l, y); ctx.lineTo(M.l + cw, y); ctx.stroke();
      ctx.fillStyle = '#9c9a95';
      ctx.fillText(p + '%', M.l - 7, y);
    }

    // X labels
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '10px IBM Plex Mono, monospace';
    ctx.fillStyle = '#9c9a95';
    for (let i = 0; i < maxPos; i++) {
      ctx.fillText(String(i + 1), M.l + (i + 0.5) * gap, M.t + ch + 5);
    }

    // Axis labels
    ctx.textAlign = 'center';
    ctx.fillStyle = '#9c9a95';
    ctx.font = '9px IBM Plex Mono, monospace';
    ctx.fillText('Serial position', M.l + cw / 2, H - 5);
    ctx.save();
    ctx.translate(12, M.t + ch / 2);
    ctx.rotate(-Math.PI / 2);
    ctx.fillText('Accuracy', 0, 0);
    ctx.restore();

    // Bars
    for (const cond of ['forward', 'backward']) {
      const data = sp[cond] || [];
      const ci = cond === 'forward' ? 0 : 1;
      for (let i = 0; i < data.length && i < maxPos; i++) {
        if (data[i] === null) continue;
        const bh = (Math.min(100, Math.max(0, data[i])) / 100) * ch;
        const x = M.l + (i + 0.5) * gap + (ci - 0.5) * bw;
        ctx.fillStyle = clr[cond];
        ctx.globalAlpha = ci === 0 ? 0.85 : 0.7;
        ctx.fillRect(x, M.t + ch - bh, bw - 2, bh);
        ctx.globalAlpha = 1;
      }
    }

    // Legend
    let lx = M.l + 8;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '10px DM Sans, sans-serif';
    for (const cond of ['forward', 'backward']) {
      ctx.fillStyle = clr[cond];
      ctx.fillRect(lx, M.t + 4, 12, 12);
      ctx.fillStyle = '#63605b';
      ctx.fillText(labels[cond], lx + 17, M.t + 10);
      lx += 85;
    }
  },

  _reset() {
    this._cond = 'forward';
    this._isPractice = false;
    this._currentLevel = 3;
    this._trialsHere = [];
    this._allTrials = [];
    this._practiceLeft = 2;
    this._inputRevealTime = 0;
    this._fwdSpan = 0;
    this._bwdSpan = 0;
    this._onComplete = null;
    this._onReady = null;
    this._rng = null;
    this._cleanup();
  },

  _showInstructions(cond) {
    this._cond = cond;
    this._renderInstructions(cond);
    showScreen('s-instructions');
  },

  _renderInstructions(cond) {
    const fwd = cond === 'forward';
    document.getElementById('inst-body').innerHTML = `
      <div class="badge ${fwd ? 'badge-blue' : 'badge-amber'}" style="margin-bottom:.75rem">
        Condition ${fwd ? '1' : '2'} of 2
      </div>
      <h2 style="margin-bottom:.75rem">${fwd ? 'Forward' : 'Backward'} Digit Span</h2>
      <p style="margin-bottom:1rem">
        Digits will appear <strong>one at a time</strong>, each for about ¾ of a second.
        After the last digit, ${fwd
          ? 'type them back <strong>in the same order</strong> they were shown.'
          : 'type them back <strong>in reverse order</strong>. Shown 3 → 9 → 2? Type <span style="font-family:var(--mono);font-weight:600">293</span>.'}
      </p>
      <div style="background:var(--surf2);border:1px solid var(--bd);border-radius:var(--r-sm);padding:.875rem 1.25rem;margin-bottom:1rem">
        <div class="label" style="margin-bottom:.5rem">Example</div>
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;font-size:.875rem;color:var(--ink2)">
          <span>Shown: <span style="font-family:var(--mono);font-weight:600;color:var(--ink)">4 → 8 → 2</span></span>
          <span>→</span>
          <span>Type: <span style="font-family:var(--mono);font-weight:600;color:var(--ink)">${fwd ? '482' : '284'}</span></span>
        </div>
      </div>
      <ul style="font-size:.875rem;color:var(--ink2);padding-left:1.25rem;line-height:2">
        <li>Sequences start at length ${fwd ? '3' : '2'} and increase to ${fwd ? '9' : '8'}</li>
        <li>2 trials per length — pass if at least 1 is correct</li>
        <li>Type digits without spaces · press <span style="font-family:var(--mono)">Enter</span> to submit</li>
      </ul>
    `;
    document.getElementById('btn-practice').style.display = fwd ? '' : 'none';
  },

  _makeSeq(len) {
    const seq = [];
    while (seq.length < len) {
      const d = Math.floor(this._rng() * 9) + 1;
      if (!seq.length || seq[seq.length - 1] !== d) seq.push(d);
    }
    return seq;
  },

  startPractice() {
    this._isPractice = true;
    this._practiceLeft = 2;
    this._launchTrial(3);
  },

  startActualTest() {
    this._isPractice = false;
    this._currentLevel = this._cond === 'backward' ? 2 : 3;
    this._trialsHere = [];
    this._launchTrial(this._currentLevel);
  },

  _TFIX: 900, _TDIG: 750, _TISI: 300, _TFB: 1300, _TIMEOUT: 30000,

  _buildDots() {
    const minL = this._cond === 'backward' ? 2 : 3;
    const maxL = this._cond === 'forward' ? 9 : 8;
    let html = '';
    for (let l = minL; l <= maxL; l++) {
      const here = this._allTrials.filter(t => t.level === l && t.condition === this._cond && !t.isPractice);
      let cls = 'dot';
      if (here.length) {
        if (here.some(t => t.correct)) cls += ' pass';
        else cls += ' fail';
      }
      if (!this._isPractice && l === this._currentLevel) cls += ' active';
      html += `<div class="${cls}">${l}</div>`;
    }
    document.getElementById('t-dots').innerHTML = html;
  },

  _launchTrial(level) {
    showScreen('s-trial');
    document.getElementById('t-cond-label').textContent =
      this._cond === 'forward' ? 'Forward span' : 'Backward span';
    document.getElementById('t-level').textContent = level;
    document.getElementById('t-status').textContent =
      this._isPractice ? 'Practice trial' :
      `Trial ${this._trialsHere.length + 1} at length ${level}`;
    this._buildDots();
    this._runOneTrial(level);
  },

  _runOneTrial(level) {
    const seq = this._makeSeq(level);
    const stage = document.getElementById('trial-stage');
    const TFIX = this._TFIX, TDIG = this._TDIG, TISI = this._TISI;

    const sched = [];
    let t = 0;
    sched.push({ t: 0, fn: () => { stage.innerHTML = '<div class="fixation pop">+</div><div class="trial-prompt" style="margin-top:-.5rem">Get ready…</div>'; } });
    for (let i = 0; i < seq.length; i++) {
      const d = seq[i];
      sched.push({ t, fn: () => { stage.innerHTML = `<div class="digit-display pop">${d}</div>`; } });
      t += TDIG;
      if (i < seq.length - 1) {
        sched.push({ t, fn: () => { stage.innerHTML = ''; } });
        t += TISI;
      }
    }
    t += TFIX;
    sched.push({ t, fn: () => this._showInput(seq) });

    this._cleanup();
    this._schedTimers = sched.map(({ t: delay, fn }) => setTimeout(fn, delay));
  },

  _showInput(seq) {
    this._inputRevealTime = performance.now();
    const bwd = this._cond === 'backward';
    const stage = document.getElementById('trial-stage');
    stage.innerHTML = `
      <div class="trial-prompt" style="margin-bottom:.75rem">
        ${bwd ? 'Type the digits in <strong>reverse</strong> order:' : 'Type the digits in order:'}
      </div>
      <div class="answer-row">
        <input type="text" id="ans" inputmode="numeric" maxlength="9"
          autocomplete="off" autocorrect="off" spellcheck="false" autofocus
          oninput="this.value=this.value.replace(/[^1-9]/g,'')">
        <button class="btn btn-primary" onclick="DigitSpan._submitAns(${JSON.stringify(seq)})">Submit</button>
      </div>
      <div class="trial-prompt" style="margin-top:.5rem;font-size:.78rem;color:var(--ink3)">
        Digits 1–9 only · no spaces · Enter to confirm
      </div>
    `;
    const inp = document.getElementById('ans');
    if (inp) {
      inp.focus();
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') DigitSpan._submitAns(seq); });
    }
    this._timeoutId = setTimeout(() => this._handleTimeout(seq), this._TIMEOUT);
  },

  _handleTimeout(seq) {
    const inp = document.getElementById('ans');
    if (!inp) return;
    this._cleanup();
    const expected = this._cond === 'backward' ? [...seq].reverse() : [...seq];
    const trial = this._buildTrial(seq, expected, '', 0, false, 'timeout');
    this._recordTrial(trial);
    this._showTimeoutFeedback(expected, seq.length);
  },

  _showTimeoutFeedback(expected, level) {
    const stage = document.getElementById('trial-stage');
    stage.innerHTML = `
      <div class="fb-box fb-wrong pop">
        <div class="fb-title">⏱ Time's up!</div>
        <div style="font-size:.8rem;margin-top:.3rem">Answer: <span class="fb-seq">${expected.join(' ')}</span></div>
        ${this._isPractice ? '<div style="font-size:.78rem;opacity:.75;margin-top:.25rem">Practice — not scored</div>' : ''}
      </div>
    `;
    setTimeout(() => this._isPractice ? this._advancePractice(level) : this._advanceStaircase(level), this._TFB);
  },

  _buildTrial(seq, expected, typedStr, rt, correct, errorType) {
    const posErr = expected.length && typedStr.length === expected.length
      ? expected.map((d, i) => Number(typedStr[i] === String(d))).join(',')
      : '';
    return {
      task: this.id,
      condition: this._cond,
      block: '',
      trial_no: this._allTrials.filter(t => !t.is_practice).length + 1,
      level: seq.length,
      stimulus: seq.join(''),
      correct_answer: expected.join(''),
      response: typedStr,
      correct,
      error_type: errorType,
      rt_ms: errorType === 'timeout' ? null : Math.round(rt),
      rt_outlier: false,
      is_practice: this._isPractice,
      position_errors: posErr,
      timestamp: new Date().toISOString(),
    };
  },

  _recordTrial(trial) {
    if (this._timeoutId) { clearTimeout(this._timeoutId); this._timeoutId = null; }
    if (!trial.is_practice) {
      this._allTrials.push(trial);
      this._trialsHere.push({ correct: trial.correct, level: trial.level });
    }
  },

  _submitAns(seq) {
    this._cleanup();
    const inp = document.getElementById('ans');
    if (!inp) return;
    const rt = performance.now() - this._inputRevealTime;
    const typed = inp.value.split('').filter(c => c >= '1' && c <= '9');
    const typedStr = typed.join('');
    const expected = this._cond === 'backward' ? [...seq].reverse() : [...seq];
    const correct = typed.length === expected.length && typed.every((d, i) => d === String(expected[i]));
    const errType = correct ? 'none' : this._classifyError(expected, typed.map(Number));
    const trial = this._buildTrial(seq, expected, typedStr, rt, correct, errType);
    this._recordTrial(trial);
    this._showFeedback(expected, typedStr, correct, seq.length);
  },

  _classifyError(expected, typed) {
    if (expected.length !== typed.length) return 'length';
    const es = [...expected].sort((a, b) => a - b).join(',');
    const ts = [...typed].sort((a, b) => a - b).join(',');
    return es === ts ? 'transposition' : 'substitution';
  },

  _showFeedback(expected, typedStr, correct, level) {
    const stage = document.getElementById('trial-stage');
    stage.innerHTML = `
      <div class="fb-box ${correct ? 'fb-correct' : 'fb-wrong'} pop">
        <div class="fb-title">${correct ? '✓ Correct' : '✗ Incorrect'}</div>
        ${!correct ? `<div style="font-size:.8rem;margin-top:.3rem">Answer: <span class="fb-seq">${expected.join(' ')}</span></div>` : ''}
        ${this._isPractice ? '<div style="font-size:.78rem;opacity:.75;margin-top:.25rem">Practice — not scored</div>' : ''}
      </div>
    `;
    setTimeout(() => this._isPractice ? this._advancePractice(level) : this._advanceStaircase(level), this._TFB);
  },

  _advancePractice(level) {
    this._practiceLeft--;
    if (this._practiceLeft > 0) {
      this._runOneTrial(level);
    } else {
      document.getElementById('trial-stage').innerHTML = `
        <div style="text-align:center" class="fade-up">
          <div style="font-size:2rem;margin-bottom:.75rem">✓</div>
          <h3 style="margin-bottom:.4rem">Practice complete</h3>
          <p style="font-size:.875rem;color:var(--ink2);margin-bottom:1.25rem">You're ready for the real test.</p>
          <button class="btn btn-primary btn-lg" onclick="DigitSpan.startActualTest()">Start test →</button>
        </div>
      `;
      document.getElementById('t-status').textContent = 'Ready';
      document.getElementById('t-dots').innerHTML = '';
    }
  },

  _advanceStaircase(level) {
    const maxL = this._cond === 'forward' ? 9 : 8;
    const total = this._trialsHere.length;
    const nCorrect = this._trialsHere.filter(t => t.correct).length;

    if (total < 2) {
      document.getElementById('t-status').textContent = `Trial ${total + 1} at length ${level}`;
      this._buildDots();
      this._runOneTrial(level);
      return;
    }

    if (nCorrect >= 1) {
      if (level >= maxL) { this._endCondition(); return; }
      this._currentLevel = level + 1;
      this._trialsHere = [];
      document.getElementById('t-level').textContent = this._currentLevel;
      document.getElementById('t-status').textContent = `Trial 1 at length ${this._currentLevel}`;
      this._buildDots();
      this._runOneTrial(this._currentLevel);
    } else {
      this._endCondition();
    }
  },

  _computeSpan(cond) {
    let span = 0;
    const trials = this._allTrials.filter(t => t.condition === cond && !t.is_practice);
    const levels = [...new Set(trials.map(t => t.level))].sort((a, b) => a - b);
    for (const l of levels) {
      if (trials.filter(t => t.level === l).some(t => t.correct)) span = l;
    }
    return span;
  },

  _endCondition() {
    if (this._cond === 'forward') {
      this._fwdSpan = this._computeSpan('forward');
      const fwdAll = this._allTrials.filter(t => t.condition === 'forward' && !t.is_practice);
      const acc = fwdAll.length ? Math.round(fwdAll.filter(t => t.correct).length / fwdAll.length * 100) : 0;
      this._trialsHere = [];
      document.getElementById('brk-content').innerHTML = `
        <div class="badge badge-green" style="margin-bottom:1rem;padding:4px 14px">Forward span complete</div>
        <h2 style="margin-bottom:1rem">First condition finished</h2>
        <div class="stats-grid" style="max-width:280px;margin:0 auto 1.5rem">
          <div class="stat-card"><div class="stat-val">${this._fwdSpan}</div><div class="stat-label">Forward span</div></div>
          <div class="stat-card"><div class="stat-val">${acc}%</div><div class="stat-label">Accuracy</div></div>
        </div>
        <div class="divider"></div>
        <div style="background:var(--amber-bg);border:1px solid #e0c888;border-radius:var(--r-sm);padding:1rem 1.25rem;text-align:left;margin-bottom:1.5rem">
          <strong>Next: Backward Digit Span</strong>
          <p style="margin-top:.4rem;font-size:.875rem">
            You'll see digits appear one at a time as before — but now type them back <strong>in reverse order</strong>.
            If you saw <span style="font-family:var(--mono);font-weight:600">3 → 9 → 2</span>, you would type
            <span style="font-family:var(--mono);font-weight:600">293</span>.
          </p>
        </div>
        <button class="btn btn-primary btn-lg" onclick="DigitSpan.beginBackward()" style="width:100%">Begin backward span →</button>
      `;
      showScreen('s-break');
    } else {
      this._bwdSpan = this._computeSpan('backward');
      S.taskActive = false;
      if (this._onComplete) this._onComplete(this._buildResults());
    }
  },

  beginBackward() {
    this._cond = 'backward';
    this._showInstructions('backward');
  },

  _buildResults() {
    const real = this._allTrials.filter(t => !t.is_practice);
    const rtVals = real.filter(t => t.rt_ms !== null && t.correct).map(t => t.rt_ms);
    const meanRT = rtVals.length ? rtVals.reduce((a, b) => a + b, 0) / rtVals.length / 1000 : 0;
    const rawScore = real.filter(t => t.correct).length;
    const errors = real.filter(t => !t.correct);

    const spCurve = { forward: [], backward: [] };
    for (const cond of ['forward', 'backward']) {
      const condTrials = real.filter(t => t.condition === cond && t.response && t.response.length > 0);
      const maxLen = condTrials.length ? Math.max(...condTrials.map(t => t.stimulus.length)) : 0;
      for (let pos = 0; pos < maxLen; pos++) {
        const atPos = condTrials.filter(t => t.stimulus.length > pos && t.position_errors);
        if (!atPos.length) { spCurve[cond].push(null); continue; }
        const correct = atPos.filter(t => {
          const bits = t.position_errors.split(',').map(Number);
          return bits[pos] === 1;
        }).length;
        spCurve[cond].push(Math.round(correct / atPos.length * 100));
      }
    }

    for (const cond of ['forward', 'backward']) {
      const condReal = real.filter(t => t.condition === cond && t.rt_ms !== null);
      const mean = condReal.length ? condReal.reduce((a, b) => a + b.rt_ms, 0) / condReal.length : 0;
      const sd = condReal.length > 1 ? Math.sqrt(condReal.reduce((s, t) => s + (t.rt_ms - mean) ** 2, 0) / condReal.length) : 0;
      for (const t of condReal) {
        t.rt_outlier = t.rt_ms < 200 || t.rt_ms > mean + 3 * sd;
      }
    }

    return {
      forwardSpan: this._fwdSpan,
      backwardSpan: this._bwdSpan,
      rawScore,
      meanRT,
      trials: this._allTrials,
      errorBreakdown: {
        transposition: errors.filter(t => t.error_type === 'transposition').length,
        substitution: errors.filter(t => t.error_type === 'substitution').length,
        length: errors.filter(t => t.error_type === 'length').length,
      },
      serialPositionCurve: spCurve,
    };
  },

  _buildAccuracyRows(real, fwdSpan, bwdSpan) {
    let html = '';
    for (const cond of ['forward', 'backward']) {
      const ct = real.filter(t => t.condition === cond);
      const ls = [...new Set(ct.map(t => t.level))].sort((a, b) => a - b);
      const span = cond === 'forward' ? fwdSpan : bwdSpan;
      for (const l of ls) {
        const at = ct.filter(t => t.level === l);
        const n = at.length, c = at.filter(t => t.correct).length;
        const acc = n ? Math.round(c / n * 100) : 0;
        const clr = acc >= 50 ? 'var(--green)' : 'var(--red)';
        html += `<tr>
          <td style="font-family:var(--mono);font-weight:600">${l}</td>
          <td><span class="badge ${cond === 'forward' ? 'badge-blue' : 'badge-amber'}">${cond}</span></td>
          <td>${n}</td><td>${c}</td>
          <td>
            <div class="acc-wrap"><div class="acc-fill" style="width:${acc}%;background:${clr}"></div></div>
            ${acc}%
            ${l === span ? '<span class="badge badge-green" style="font-size:.68rem;padding:1px 6px;margin-left:4px">span</span>' : ''}
          </td>
        </tr>`;
      }
    }
    return html;
  },
};

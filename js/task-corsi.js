// ── Corsi Block-Tapping Task ──
const Corsi = {
  id: 'corsi',
  label: 'Corsi Block-Tapping',

  _cond: 'forward',
  _isPractice: false,
  _currentLevel: 2,
  _trialsHere: [],
  _allTrials: [],
  _practiceLeft: 2,
  _fwdSpan: 0,
  _bwdSpan: 0,
  _onComplete: null,
  _timeoutId: null,
  _rng: null,
  _userClicks: [],
  _inputStart: 0,
  _seq: [],
  _waitingInput: false,
  _schedTimers: [],

  _BLOCK_POS: [
    { x: 110, y: 348 }, { x: 305, y: 370 }, { x: 218, y: 262 },
    { x: 89, y: 197 }, { x: 348, y: 218 }, { x: 240, y: 132 },
    { x: 132, y: 89 }, { x: 326, y: 89 }, { x: 197, y: 361 },
  ],
  _BS: 48, _CS: 480,
  _TSHOW: 800, _TISI: 400, _TFB: 1300, _TIMEOUT: 30000,

  showInstructions(onReady) {
    this._onReady = onReady;
    showScreen('s-corsi');
    document.getElementById('co-controls').innerHTML = `
      <div style="text-align:center;padding:.5rem 0 1rem">
        <div class="badge badge-blue" style="margin-bottom:.5rem">${getTaskBadge(this.id)}</div>
        <h2 style="margin-bottom:.75rem">Corsi Block-Tapping</h2>
        <p style="font-size:.9rem;margin-bottom:1rem">
          A sequence of blocks will light up one at a time.
          Your job is to click the blocks back <strong>in the same order</strong> (forward) or
          <strong>in reverse order</strong> (backward).
        </p>
        <ul style="font-size:.85rem;color:var(--ink2);padding-left:1.25rem;line-height:2;text-align:left;max-width:380px;margin:0 auto .75rem">
          <li>Sequences start at length 2 and increase up to 8</li>
          <li>2 trials per length — pass if at least 1 is correct</li>
          <li>Click blocks in order · Click <strong>Clear</strong> to restart · Click <strong>Submit</strong> when done</li>
        </ul>
      </div>
      <div style="display:flex;gap:.75rem;justify-content:center">
        <button class="btn" onclick="Corsi._startPractice()">Practice first</button>
        <button class="btn btn-primary" onclick="Corsi._startActualTest()">Start test →</button>
      </div>
    `;
  },

  run(onComplete) {
    this._reset();
    S.taskActive = true;
    this._onComplete = onComplete;
    this._rng = rng();
    this.showInstructions();
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
        <div class="stat-card"><div class="stat-val">${results.kesselsTotal}</div><div class="stat-label">Kessels total score</div></div>
      </div>
      <div class="divider"></div>
      <h3 style="margin-bottom:.5rem">Accuracy by span length</h3>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Length</th><th>Condition</th><th>Trials</th><th>Correct</th><th>Accuracy</th></tr></thead>
          <tbody>${this._buildAccuracyRows(real, results.forwardSpan, results.backwardSpan)}</tbody>
        </table>
      </div>
    `;
  },

  _reset() {
    this._cond = 'forward';
    this._isPractice = false;
    this._currentLevel = 2;
    this._trialsHere = [];
    this._allTrials = [];
    this._practiceLeft = 2;
    this._fwdSpan = 0;
    this._bwdSpan = 0;
    this._onComplete = null;
    this._onReady = null;
    this._rng = null;
    this._userClicks = [];
    this._inputStart = 0;
    this._seq = [];
    this._waitingInput = false;
    this._submitted = false;
    this._schedTimers = [];
    this._cleanup();
  },

  _cleanup() {
    if (this._timeoutId) { clearTimeout(this._timeoutId); this._timeoutId = null; }
    for (const t of this._schedTimers) clearTimeout(t);
    this._schedTimers = [];
    this._waitingInput = false;
  },

  _makeSeq(len) {
    const seq = [];
    while (seq.length < len) {
      const d = Math.floor(this._rng() * 9);
      if (!seq.length || seq[seq.length - 1] !== d) seq.push(d);
    }
    return seq;
  },

  _drawBlock(ctx, idx, highlight) {
    const p = this._BLOCK_POS[idx];
    const s = this._BS;
    const x = p.x - s / 2, y = p.y - s / 2;
    const r = 6;
    ctx.fillStyle = highlight ? '#2448c0' : '#ffffff';
    ctx.strokeStyle = highlight ? '#2448c0' : '#e0dbd2';
    ctx.lineWidth = highlight ? 2.5 : 1;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + s - r, y);
    ctx.quadraticCurveTo(x + s, y, x + s, y + r);
    ctx.lineTo(x + s, y + s - r);
    ctx.quadraticCurveTo(x + s, y + s, x + s - r, y + s);
    ctx.lineTo(x + r, y + s);
    ctx.quadraticCurveTo(x, y + s, x, y + s - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Number label
    if (!highlight) {
      ctx.fillStyle = '#9c9a95';
      ctx.font = '11px IBM Plex Mono, monospace';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(String(idx + 1), p.x, p.y);
    }
  },

  _drawAll(ctx, highlights) {
    const W = this._CS, H = this._CS;
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#f7f5f0';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 9; i++) {
      this._drawBlock(ctx, i, highlights.includes(i));
    }
  },

  _presentSequence(seq) {
    const canvas = document.getElementById('co-canvas');
    const ctx = canvas.getContext('2d');
    const sched = [];
    let t = 0;
    sched.push({ t, fn: () => this._drawAll(ctx, []) });
    for (let i = 0; i < seq.length; i++) {
      const b = seq[i];
      sched.push({ t, fn: () => this._drawAll(ctx, [b]) });
      t += this._TSHOW;
      sched.push({ t, fn: () => this._drawAll(ctx, []) });
      t += this._TISI;
    }
    t += 200;
    sched.push({ t, fn: () => this._startInput(seq) });
    this._schedTimers = sched.map(({ t: delay, fn }) => setTimeout(fn, delay));
  },

  _startInput(seq) {
    this._submitted = false;
    this._userClicks = [];
    this._waitingInput = true;
    this._inputStart = performance.now();
    const canvas = document.getElementById('co-canvas');
    canvas.onclick = (e) => this._handleCanvasClick(e);
    document.getElementById('co-controls').innerHTML = `
      <div style="font-size:.9rem;color:var(--ink2);margin-bottom:.5rem">
        ${this._cond === 'backward' ? 'Click blocks in <strong>reverse</strong> order:' : 'Click blocks in order:'}
        <span style="font-family:var(--mono);font-size:.8rem;color:var(--ink3)">(${seq.length} clicks needed)</span>
      </div>
      <div style="display:flex;gap:.5rem;justify-content:center">
        <button class="btn" onclick="Corsi._clearClicks()" style="font-size:.8rem">Clear</button>
        <button class="btn btn-primary" onclick="Corsi._submitClicks()" style="font-size:.8rem">Submit</button>
      </div>
    `;
    this._timeoutId = setTimeout(() => this._handleTimeout(), this._TIMEOUT);
  },

  _hitTest(x, y) {
    const half = this._BS / 2;
    for (let i = 0; i < 9; i++) {
      const p = this._BLOCK_POS[i];
      if (x >= p.x - half && x <= p.x + half && y >= p.y - half && y <= p.y + half) return i;
    }
    return -1;
  },

  _handleCanvasClick(e) {
    if (!this._waitingInput) return;
    const canvas = document.getElementById('co-canvas');
    const rect = canvas.getBoundingClientRect();
    const scale = this._CS / rect.width;
    const x = (e.clientX - rect.left) * scale;
    const y = (e.clientY - rect.top) * scale;
    const idx = this._hitTest(x, y);
    if (idx === -1) return;
    this._userClicks.push(idx);
    this._flashBlock(idx);
    if (this._userClicks.length >= this._seq.length) {
      this._waitingInput = false;
      setTimeout(() => this._submitClicks(), 200);
    }
  },

  _flashBlock(idx) {
    const canvas = document.getElementById('co-canvas');
    const ctx = canvas.getContext('2d');
    this._drawAll(ctx, [idx]);
    setTimeout(() => {
      if (this._waitingInput) this._drawAll(ctx, []);
    }, 100);
  },

  _clearClicks() {
    if (!this._waitingInput) return;
    this._userClicks = [];
    const canvas = document.getElementById('co-canvas');
    this._drawAll(canvas.getContext('2d'), []);
  },

  _submitClicks() {
    if (this._submitted) return;
    this._submitted = true;
    this._cleanup();
    const seq = this._seq;
    const canvas = document.getElementById('co-canvas');
    canvas.onclick = null;
    const expected = this._cond === 'backward' ? [...seq].reverse() : [...seq];
    const typed = this._userClicks;
    const correct = typed.length === expected.length && typed.every((d, i) => d === expected[i]);
    const errType = correct ? 'none' : this._classifyError(expected, typed);
    const rt = performance.now() - this._inputStart;
    const posErr = expected.length && typed.length === expected.length
      ? expected.map((d, i) => Number(typed[i] === d)).join(',')
      : '';
    const trial = {
      task: this.id, condition: this._cond, block: '',
      trial_no: this._allTrials.filter(t => !t.is_practice).length + 1,
      level: seq.length, stimulus: seq.join(','),
      correct_answer: expected.join(','), response: typed.join(','),
      correct, error_type: errType, rt_ms: Math.round(rt),
      rt_outlier: false, is_practice: this._isPractice,
      position_errors: posErr, timestamp: new Date().toISOString(),
    };
    this._recordTrial(trial);
    this._showFeedback(expected, typed, correct, seq.length);
  },

  _handleTimeout() {
    if (this._submitted) return;
    this._submitted = true;
    this._cleanup();
    const seq = this._seq;
    const canvas = document.getElementById('co-canvas');
    canvas.onclick = null;
    const expected = this._cond === 'backward' ? [...seq].reverse() : [...seq];
    const trial = {
      task: this.id, condition: this._cond, block: '',
      trial_no: this._allTrials.filter(t => !t.is_practice).length + 1,
      level: seq.length, stimulus: seq.join(','),
      correct_answer: expected.join(','), response: '',
      correct: false, error_type: 'timeout', rt_ms: null,
      rt_outlier: false, is_practice: this._isPractice,
      position_errors: '', timestamp: new Date().toISOString(),
    };
    this._recordTrial(trial);
    this._showTimeoutFeedback(expected);
  },

  _showTimeoutFeedback(expected) {
    const controls = document.getElementById('co-controls');
    controls.innerHTML = `
      <div class="fb-box fb-wrong pop">
        <div class="fb-title">⏱ Time's up!</div>
        <div style="font-size:.8rem;margin-top:.3rem">Sequence: <span class="fb-seq">${expected.join(' ')}</span></div>
      </div>
    `;
    setTimeout(() => this._isPractice ? this._advancePractice() : this._advanceStaircase(), this._TFB);
  },

  _classifyError(expected, typed) {
    if (expected.length !== typed.length) return 'length';
    const es = [...expected].sort((a, b) => a - b).join(',');
    const ts = [...typed].sort((a, b) => a - b).join(',');
    return es === ts ? 'transposition' : 'substitution';
  },

  _showFeedback(expected, typed, correct, level) {
    const controls = document.getElementById('co-controls');
    controls.innerHTML = `
      <div class="fb-box ${correct ? 'fb-correct' : 'fb-wrong'} pop">
        <div class="fb-title">${correct ? '✓ Correct' : '✗ Incorrect'}</div>
        ${!correct ? `<div style="font-size:.8rem;margin-top:.3rem">Sequence: <span class="fb-seq">${expected.join(' ')}</span></div>` : ''}
        ${this._isPractice ? '<div style="font-size:.78rem;opacity:.75;margin-top:.25rem">Practice — not scored</div>' : ''}
      </div>
    `;
    setTimeout(() => this._isPractice ? this._advancePractice() : this._advanceStaircase(), this._TFB);
  },

  _recordTrial(trial) {
    if (!trial.is_practice) {
      this._allTrials.push(trial);
      this._trialsHere.push({ correct: trial.correct, level: trial.level });
    }
  },

  _startPractice() {
    this._isPractice = true;
    this._practiceLeft = 2;
    this._launchTrial(2);
  },

  _startActualTest() {
    this._isPractice = false;
    this._currentLevel = 2;
    this._trialsHere = [];
    this._launchTrial(this._currentLevel);
  },

  _launchTrial(level) {
    showScreen('s-corsi');
    document.getElementById('co-level').textContent = level;
    document.getElementById('co-status').textContent = this._isPractice
      ? 'Practice trial' : `Trial ${this._trialsHere.length + 1} at length ${level}`;
    this._launchSequence(level);
  },

  _launchSequence(level) {
    this._seq = this._makeSeq(level);
    const canvas = document.getElementById('co-canvas');
    const ctx = canvas.getContext('2d');
    canvas.onclick = null;
    this._drawAll(ctx, []);
    document.getElementById('co-controls').innerHTML = '<div style="color:var(--ink3);font-size:.85rem">Watch the sequence…</div>';
    this._presentSequence(this._seq);
  },

  _advancePractice() {
    this._practiceLeft--;
    if (this._practiceLeft > 0) {
      this._launchSequence(this._seq.length);
    } else {
      const canvas = document.getElementById('co-canvas');
      this._drawAll(canvas.getContext('2d'), []);
      document.getElementById('co-controls').innerHTML = `
        <div style="text-align:center" class="fade-up">
          <div style="font-size:2rem;margin-bottom:.75rem">✓</div>
          <h3 style="margin-bottom:.4rem">Practice complete</h3>
          <p style="font-size:.875rem;color:var(--ink2);margin-bottom:1.25rem">You're ready for the real test.</p>
          <button class="btn btn-primary btn-lg" onclick="Corsi._startActualTest()">Start test →</button>
        </div>
      `;
      document.getElementById('co-status').textContent = 'Ready';
    }
  },

  _advanceStaircase() {
    const maxL = 5;
    const total = this._trialsHere.length;
    const nCorrect = this._trialsHere.filter(t => t.correct).length;
    if (total < 2) {
      document.getElementById('co-status').textContent = `Trial ${total + 1} at length ${this._currentLevel}`;
      this._launchSequence(this._currentLevel);
      return;
    }
    if (nCorrect >= 1) {
      if (this._currentLevel >= maxL) { this._endCondition(); return; }
      this._currentLevel++;
      this._trialsHere = [];
      document.getElementById('co-level').textContent = this._currentLevel;
      document.getElementById('co-status').textContent = `Trial 1 at length ${this._currentLevel}`;
      this._launchSequence(this._currentLevel);
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

  _computeKesselsTotal() {
    return this._allTrials.filter(t => !t.is_practice && t.correct).length;
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
          <strong>Next: Backward Corsi</strong>
          <p style="margin-top:.4rem;font-size:.875rem">
            Blocks will light up one at a time as before — but now click them back <strong>in reverse order</strong>.
          </p>
        </div>
        <button class="btn btn-primary btn-lg" onclick="Corsi._beginBackward()" style="width:100%">Begin backward span →</button>
      `;
      showScreen('s-break');
    } else {
      this._bwdSpan = this._computeSpan('backward');
      S.taskActive = false;
      if (this._onComplete) this._onComplete(this._buildResults());
    }
  },

  _beginBackward() {
    this._cond = 'backward';
    const controls = document.getElementById('co-controls');
    controls.innerHTML = `
      <div style="text-align:center">
        <div class="badge badge-amber" style="margin-bottom:.5rem">Condition 2 of 2</div>
        <h2 style="margin-bottom:.75rem">Backward Corsi</h2>
        <p style="font-size:.9rem;margin-bottom:1rem">
          Click the blocks back <strong>in reverse order</strong> of the sequence shown.
        </p>
        <button class="btn btn-primary" onclick="Corsi._startActualTest()">Start test →</button>
      </div>
    `;
    showScreen('s-corsi');
  },

  _buildResults() {
    const real = this._allTrials.filter(t => !t.is_practice);
    const rtVals = real.filter(t => t.rt_ms !== null && t.correct).map(t => t.rt_ms);
    const meanRT = rtVals.length ? rtVals.reduce((a, b) => a + b, 0) / rtVals.length / 1000 : 0;
    const errors = real.filter(t => !t.correct);
    for (const cond of ['forward', 'backward']) {
      const ct = real.filter(t => t.condition === cond && t.rt_ms !== null);
      const mean = ct.length ? ct.reduce((s, t) => s + t.rt_ms, 0) / ct.length : 0;
      const sd = ct.length > 1 ? Math.sqrt(ct.reduce((s, t) => s + (t.rt_ms - mean) ** 2, 0) / ct.length) : 0;
      for (const t of ct) t.rt_outlier = t.rt_ms < 200 || t.rt_ms > mean + 3 * sd;
    }
    return {
      forwardSpan: this._fwdSpan, backwardSpan: this._bwdSpan,
      kesselsTotal: this._computeKesselsTotal(), meanRT,
      trials: this._allTrials,
      errorBreakdown: {
        transposition: errors.filter(t => t.error_type === 'transposition').length,
        substitution: errors.filter(t => t.error_type === 'substitution').length,
        length: errors.filter(t => t.error_type === 'length').length,
      },
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
            ${acc}%${l === span ? '<span class="badge badge-green" style="font-size:.68rem;padding:1px 6px;margin-left:4px">span</span>' : ''}
          </td>
        </tr>`;
      }
    }
    return html;
  },
};

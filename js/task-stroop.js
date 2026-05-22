// ── Stroop Task ──
const Stroop = {
  id: 'stroop',
  label: 'Stroop',

  _onComplete: null,
  _trials: [],
  _allResults: [],
  _currentIdx: 0,
  _isPractice: false,
  _trialStart: 0,
  _timeoutId: null,
  _onKeyDown: null,
  _rng: null,

  _COLORS: ['red', 'blue', 'green', 'yellow'],
  _NEUTRAL: ['TABLE', 'CHAIR', 'HOUSE', 'PLANT'],
  _INK_HEX: { red: '#b83020', blue: '#2448c0', green: '#1a7033', yellow: '#b8a020' },
  _KEY_OF: { red: 'r', blue: 'b', green: 'g', yellow: 'y' },
  _LABEL_OF: { r: 'R', b: 'B', g: 'G', y: 'Y' },
  _NAME_OF: { red: 'Red', blue: 'Blue', green: 'Green', yellow: 'Yellow' },

  showInstructions(onReady) {
    this._onReady = onReady;
    showScreen('s-stroop');
    const stage = document.getElementById('st-stage');
    stage.innerHTML = `
      <div class="badge badge-blue" style="margin-bottom:.5rem">${getTaskBadge(this.id)}</div>
      <h2 style="margin-bottom:.75rem">Stroop Task</h2>
      <p style="margin-bottom:1rem;font-size:.9rem">
        Colour words will appear in different ink colours. Your job is to identify the
        <strong>ink colour</strong> — ignore what the word says.
      </p>
      <div style="background:var(--surf2);border:1px solid var(--bd);border-radius:var(--r-sm);padding:.875rem 1.25rem;margin-bottom:1rem;width:100%">
        <div class="label" style="margin-bottom:.5rem">Example</div>
        <div style="display:flex;align-items:center;gap:1rem;flex-wrap:wrap;font-size:.875rem;color:var(--ink2)">
          <span>Word: <span style="font-family:var(--serif);font-weight:600;color:var(--green);font-size:1.2rem">GREEN</span></span>
          <span>→</span>
          <span>Press: <span style="font-family:var(--mono);font-weight:600">G</span> (ink is green, word is ignored)</span>
        </div>
      </div>
      <div class="key-legend" style="margin-bottom:.75rem">
        ${this._COLORS.map(c => `<span class="key-tag">${this._KEY_OF[c].toUpperCase()} = ${this._NAME_OF[c]}</span>`).join('')}
      </div>
      <ul style="font-size:.85rem;color:var(--ink2);padding-left:1.25rem;line-height:2;margin-bottom:.5rem;text-align:left;width:100%">
        <li>72 trials — respond as quickly and accurately as possible</li>
        <li>Press the key matching the <strong>ink colour</strong>, not the word</li>
        <li>Respond within 4 seconds — timeout counts as incorrect</li>
      </ul>
    `;
    document.getElementById('st-status').textContent = 'Instructions';
    document.getElementById('st-progress').textContent = '—';
    document.getElementById('st-stage').innerHTML += `
      <div style="display:flex;gap:.75rem;margin-top:.75rem">
        <button class="btn" style="flex:1" onclick="Stroop._startPractice()">Practice first</button>
        <button class="btn btn-primary" style="flex:1" onclick="Stroop._startTest()">Start test →</button>
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
    const conds = ['congruent', 'incongruent', 'neutral'];
    const cl = { congruent: 'Congruent', incongruent: 'Incongruent', neutral: 'Neutral' };
    const stats = {};
    for (const c of conds) {
      const ct = real.filter(t => t.condition === c);
      const corr = ct.filter(t => t.correct);
      const acc = ct.length ? Math.round(corr.length / ct.length * 100) : 0;
      const mRT = corr.length ? corr.reduce((s, t) => s + t.rt_ms, 0) / corr.length / 1000 : 0;
      stats[c] = { n: ct.length, corr: corr.length, acc, mRT };
    }
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-val" style="font-size:1.1rem">${results.netStroopEffect.toFixed(0)} ms</div><div class="stat-label">Net Stroop effect</div></div>
        <div class="stat-card"><div class="stat-val" style="font-size:1.1rem">${results.interferenceScore.toFixed(0)} ms</div><div class="stat-label">Interference (I−C)</div></div>
        <div class="stat-card"><div class="stat-val" style="font-size:1.1rem">${results.facilitationScore.toFixed(0)} ms</div><div class="stat-label">Facilitation (C−N)</div></div>
      </div>
      <div class="divider"></div>
      <h3 style="margin-bottom:.5rem">Accuracy &amp; RT by condition</h3>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Condition</th><th>Trials</th><th>Correct</th><th>Accuracy</th><th>Mean RT</th></tr></thead>
          <tbody>${conds.map(c => `<tr>
            <td>${cl[c]}</td><td>${stats[c].n}</td><td>${stats[c].corr}</td>
            <td>${stats[c].acc}%</td>
            <td style="font-family:var(--mono)">${stats[c].mRT.toFixed(2)}s</td>
          </tr>`).join('')}</tbody>
        </table>
      </div>
    `;
  },

  _reset() {
    this._trials = [];
    this._allResults = [];
    this._currentIdx = 0;
    this._isPractice = false;
    this._trialStart = 0;
    this._onComplete = null;
    this._rng = null;
    this._cleanup();
  },

  _cleanup() {
    if (this._timeoutId) { clearTimeout(this._timeoutId); this._timeoutId = null; }
    if (this._onKeyDown) { document.removeEventListener('keydown', this._onKeyDown); this._onKeyDown = null; }
  },

  _generateTrials(count) {
    const perCondition = count / 3;
    const trials = [];
    for (const condition of ['congruent', 'incongruent', 'neutral']) {
      for (let i = 0; i < perCondition; i++) {
        const color = this._COLORS[Math.floor(this._rng() * 4)];
        let word, inkColor;
        if (condition === 'congruent') {
          word = color.toUpperCase();
          inkColor = color;
        } else if (condition === 'incongruent') {
          const others = this._COLORS.filter(c => c !== color);
          word = color.toUpperCase();
          inkColor = others[Math.floor(this._rng() * others.length)];
        } else {
          word = this._NEUTRAL[Math.floor(this._rng() * 4)];
          inkColor = color;
        }
        trials.push({ word, inkColor, condition });
      }
    }
    for (let i = trials.length - 1; i > 0; i--) {
      const j = Math.floor(this._rng() * (i + 1));
      [trials[i], trials[j]] = [trials[j], trials[i]];
    }
    return trials;
  },

  _startPractice() {
    this._isPractice = true;
    this._trials = this._generateTrials(6);
    this._allResults = [];
    this._currentIdx = 0;
    this._runNext();
  },

  _startTest() {
    this._isPractice = false;
    this._trials = this._generateTrials(72);
    this._allResults = [];
    this._currentIdx = 0;
    this._runNext();
  },

  _runNext() {
    if (this._currentIdx >= this._trials.length) {
      if (this._isPractice) {
        this._showPracticeComplete();
      } else {
        this._finish();
      }
      return;
    }
    this._showTrial(this._trials[this._currentIdx]);
  },

  _showTrial(trial) {
    showScreen('s-stroop');
    document.getElementById('st-status').textContent = this._isPractice ? 'Practice trial' : 'Test';
    document.getElementById('st-progress').textContent = this._isPractice
      ? `${this._currentIdx + 1} / ${this._trials.length}`
      : `${this._currentIdx + 1} / ${this._trials.length}`;
    const stage = document.getElementById('st-stage');
    stage.innerHTML = `
      <div class="stroop-word" style="color:${this._INK_HEX[trial.inkColor]}">${trial.word}</div>
      <div class="key-legend">
        ${this._COLORS.map(c => `<span class="key-tag">${this._KEY_OF[c].toUpperCase()} = ${this._NAME_OF[c]}</span>`).join('')}
      </div>
      <div style="font-size:.78rem;color:var(--ink3)">Press a key to respond</div>
    `;
    this._trialStart = performance.now();
    this._onKeyDown = (e) => this._onKeyPress(e);
    document.addEventListener('keydown', this._onKeyDown);
    this._timeoutId = setTimeout(() => this._onTimeout(), 4000);
  },

  _onKeyPress(e) {
    const key = e.key.toLowerCase();
    if (!['r', 'b', 'g', 'y'].includes(key)) return;
    e.preventDefault();
    this._cleanup();
    const rt = performance.now() - this._trialStart;
    const trial = this._trials[this._currentIdx];
    const correct = key === this._KEY_OF[trial.inkColor];
    const errType = correct ? 'none' : 'substitution';
    this._recordTrial(trial, key, rt, correct, errType);
  },

  _onTimeout() {
    this._cleanup();
    const trial = this._trials[this._currentIdx];
    this._recordTrial(trial, '', null, false, 'timeout');
  },

  _recordTrial(trial, key, rtMs, correct, errType) {
    this._allResults.push({
      task: this.id,
      condition: trial.condition,
      block: '',
      level: '',
      stimulus: trial.word,
      correct_answer: trial.inkColor,
      response: key || '',
      correct,
      error_type: errType,
      rt_ms: rtMs !== null ? Math.round(rtMs) : null,
      rt_outlier: false,
      is_practice: this._isPractice,
      position_errors: '',
      timestamp: new Date().toISOString(),
    });
    this._currentIdx++;
    if (this._currentIdx >= this._trials.length) {
      if (this._isPractice) {
        this._showPracticeComplete();
      } else {
        this._finish();
      }
      return;
    }
    if (this._isPractice) {
      const fbTrial = trial;
      const fbCorrect = key === this._KEY_OF[fbTrial.inkColor];
      const stage = document.getElementById('st-stage');
      stage.innerHTML = `
        <div class="fb-box ${fbCorrect ? 'fb-correct' : 'fb-wrong'} pop">
          <div class="fb-title">${fbCorrect ? '✓ Correct' : '✗ Incorrect'}</div>
          ${!fbCorrect ? `<div style="font-size:.8rem;margin-top:.3rem">Correct: <strong>${this._NAME_OF[fbTrial.inkColor]}</strong> (key: ${this._KEY_OF[fbTrial.inkColor].toUpperCase()})</div>` : ''}
          <div style="font-size:.78rem;opacity:.75;margin-top:.25rem">Practice — not scored</div>
        </div>
      `;
      setTimeout(() => this._runNext(), 1500);
    } else {
      document.getElementById('st-stage').innerHTML = '';
      setTimeout(() => this._runNext(), 500);
    }
  },

  _showPracticeComplete() {
    document.getElementById('st-stage').innerHTML = `
      <div style="text-align:center" class="fade-up">
        <div style="font-size:2rem;margin-bottom:.75rem">✓</div>
        <h3 style="margin-bottom:.4rem">Practice complete</h3>
        <p style="font-size:.875rem;color:var(--ink2);margin-bottom:1.25rem">You're ready for the real test.</p>
        <button class="btn btn-primary btn-lg" onclick="Stroop._startTest()">Start test →</button>
      </div>
    `;
    document.getElementById('st-status').textContent = 'Ready';
    document.getElementById('st-progress').textContent = '—';
  },

  _finish() {
    S.taskActive = false;
    const real = this._allResults.filter(t => !t.is_practice);
    for (const cond of ['congruent', 'incongruent', 'neutral']) {
      const ct = real.filter(t => t.condition === cond && t.rt_ms !== null);
      const mean = ct.length ? ct.reduce((s, t) => s + t.rt_ms, 0) / ct.length : 0;
      const sd = ct.length > 1 ? Math.sqrt(ct.reduce((s, t) => s + (t.rt_ms - mean) ** 2, 0) / ct.length) : 0;
      for (const t of ct) {
        t.rt_outlier = t.rt_ms < 200 || t.rt_ms > mean + 3 * sd;
      }
    }
    const correctTrials = real.filter(t => t.correct && !t.rt_outlier);
    const m = {};
    for (const cond of ['congruent', 'incongruent', 'neutral']) {
      const ct = correctTrials.filter(t => t.condition === cond);
      m[cond] = ct.length ? ct.reduce((s, t) => s + t.rt_ms, 0) / ct.length : 0;
    }
    this._cleanup();
    if (this._onComplete) this._onComplete({
      trials: this._allResults,
      meanRTCongruent: m.congruent,
      meanRTIncongruent: m.incongruent,
      meanRTNeutral: m.neutral,
      interferenceScore: m.incongruent - m.congruent,
      facilitationScore: m.congruent - m.neutral,
      netStroopEffect: m.incongruent - m.neutral,
    });
  },
};

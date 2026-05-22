// ── N-Back Task ──
const NBack = {
  id: 'nback',
  label: 'N-Back',

  _onComplete: null,
  _rng: null,
  _isPractice: false,
  _blockLabel: '',
  _nBack: 1,
  _currentTrials: [],
  _currentTrialIdx: 0,
  _allResults: [],
  _responded: false,
  _trialStart: 0,
  _timeoutId: null,
  _hideTimeoutId: null,
  _onKeyDown: null,

  _LETTERS: ['B', 'F', 'H', 'J', 'K', 'L', 'M', 'P', 'Q', 'R', 'T', 'V'],
  _TSHOW: 500,
  _TISI: 1500,
  _TTL: 2000,
  _TFB: 1500,

  run(onComplete) {
    this._reset();
    S.taskActive = true;
    this._onComplete = onComplete;
    this._rng = rng();
    this.showInstructions();
  },

  showInstructions() {
    showScreen('s-nback');
    const stage = document.getElementById('nb-stage');
    stage.innerHTML = `
      <div class="badge badge-blue" style="margin-bottom:.5rem">${getTaskBadge(this.id)}</div>
      <h2 style="margin-bottom:.75rem">N-Back Task</h2>
      <p style="margin-bottom:1rem;font-size:.9rem">
        Letters will appear one at a time. Press the <strong>spacebar</strong> when the current
        letter matches the one shown <strong>N steps back</strong>.
      </p>
      <div style="background:var(--surf2);border:1px solid var(--bd);border-radius:var(--r-sm);padding:.875rem 1.25rem;margin-bottom:1rem;width:100%">
        <div class="label" style="margin-bottom:.5rem">How it works</div>
        <div style="font-size:.875rem;color:var(--ink2);line-height:1.75">
          <strong>1-back:</strong> Press spacebar when the letter is the <strong>same</strong> as
          the previous one.<br>
          <strong>2-back:</strong> Press spacebar when the letter matches the one <strong>two
          steps back</strong>.<br><br>
          You'll start with           1-back (8 trials), then 2-back (8 trials).
        </div>
      </div>
      <ul style="font-size:.85rem;color:var(--ink2);padding-left:1.25rem;line-height:2;margin-bottom:.5rem;text-align:left;width:100%">
        <li>Only press <strong>spacebar</strong> for matches — not for non-matches</li>
        <li>Respond within 2 seconds per trial</li>
        <li>Respond as quickly <em>and</em> accurately as you can</li>
      </ul>
      <div style="display:flex;gap:.75rem;margin-top:.75rem">
        <button class="btn" style="flex:1" onclick="NBack._startPractice()">Practice (3 trials)</button>
        <button class="btn btn-primary" style="flex:1" onclick="NBack._startTest()">Start test →</button>
      </div>
    `;
    document.getElementById('nb-status').textContent = 'Instructions';
    document.getElementById('nb-progress').textContent = '—';
  },

  getCSVRows(results, sessionMeta) {
    const base = { ...sessionMeta };
    return results.trials.map(t => ({ ...base, ...t }));
  },

  renderResults(results, container) {
    const real = results.trials.filter(t => !t.is_practice);
    const block1 = real.filter(t => t.block === '1-back');
    const block2 = real.filter(t => t.block === '2-back');
    const s1 = this._computeStats(block1, 1);
    const s2 = this._computeStats(block2, 2);
    container.innerHTML = `
      <div class="stats-grid">
        <div class="stat-card"><div class="stat-val">${s2.dPrime.toFixed(2)}</div><div class="stat-label">2-back d\u2032</div></div>
        <div class="stat-card"><div class="stat-val">${s1.dPrime.toFixed(2)}</div><div class="stat-label">1-back d\u2032</div></div>
        <div class="stat-card"><div class="stat-val">${s2.accuracy.toFixed(1)}%</div><div class="stat-label">2-back accuracy</div></div>
      </div>
      <div class="divider"></div>
      <h3 style="margin-bottom:.5rem">Per-block statistics</h3>
      <div style="overflow-x:auto">
        <table class="data-table">
          <thead><tr><th>Block</th><th>d\u2032</th><th>Hit rate</th><th>FA rate</th><th>Lure FA rate</th><th>Accuracy</th><th>Mean RT (ms)</th></tr></thead>
          <tbody>${this._statRow('1-back', s1)}${this._statRow('2-back', s2)}</tbody>
        </table>
      </div>
    `;
  },

  _statRow(label, s) {
    return `<tr>
      <td style="font-weight:500">${label}</td>
      <td style="font-family:var(--mono)">${s.dPrime.toFixed(2)}</td>
      <td style="font-family:var(--mono)">${(s.hitRate * 100).toFixed(1)}%</td>
      <td style="font-family:var(--mono)">${(s.faRate * 100).toFixed(1)}%</td>
      <td style="font-family:var(--mono)">${s.lureFaRate !== null ? (s.lureFaRate * 100).toFixed(1) + '%' : '\u2014'}</td>
      <td style="font-family:var(--mono)">${s.accuracy.toFixed(1)}%</td>
      <td style="font-family:var(--mono)">${s.meanRT !== null ? s.meanRT.toFixed(0) : '\u2014'}</td>
    </tr>`;
  },

  _reset() {
    this._onComplete = null;
    this._rng = null;
    this._isPractice = false;
    this._blockLabel = '';
    this._nBack = 1;
    this._currentTrials = [];
    this._currentTrialIdx = 0;
    this._allResults = [];
    this._responded = false;
    this._trialStart = 0;
    this._cleanup();
  },

  _cleanup() {
    if (this._timeoutId) { clearTimeout(this._timeoutId); this._timeoutId = null; }
    if (this._hideTimeoutId) { clearTimeout(this._hideTimeoutId); this._hideTimeoutId = null; }
    if (this._onKeyDown) { document.removeEventListener('keydown', this._onKeyDown); this._onKeyDown = null; }
  },

  _shuffle(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this._rng() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  },

  _generateBlock(nBack, nWarmup, nTest) {
    const total = nWarmup + nTest;
    const letters = this._LETTERS;
    const trials = [];
    const testPositions = [];
    for (let i = nWarmup; i < total; i++) testPositions.push(i);
    this._shuffle(testPositions);
    const nTargets = Math.round(nTest * 0.3);
    const nLures = nBack === 2 ? Math.round(nTest * 0.15) : 0;
    const isTarget = new Set(testPositions.slice(0, nTargets));
    const isLure = nBack === 2 ? new Set(testPositions.slice(nTargets, nTargets + nLures)) : new Set();
    for (let i = 0; i < total; i++) {
      let letter;
      const isWarmup = i < nWarmup;
      const target = !isWarmup && isTarget.has(i);
      const lure = !isWarmup && isLure.has(i);
      if (target && i >= nBack) {
        letter = trials[i - nBack].letter;
      } else if (lure && nBack === 2) {
        const options = [];
        if (i >= 1) options.push(trials[i - 1].letter);
        if (i >= 3) options.push(trials[i - 3].letter);
        const valid = options.filter(l => i < 2 || l !== trials[i - 2].letter);
        const unique = [...new Set(valid)];
        letter = unique.length ? unique[Math.floor(this._rng() * unique.length)]
          : letters.filter(l => l !== trials[i - 1].letter && (i < 2 || l !== trials[i - 2].letter))[0];
      } else {
        const exclude = new Set();
        if (i > 0) exclude.add(trials[i - 1].letter);
        if (i >= nBack) exclude.add(trials[i - nBack].letter);
        const candidates = letters.filter(l => !exclude.has(l));
        letter = candidates[Math.floor(this._rng() * candidates.length)];
      }
      trials.push({ letter, isWarmup, isTarget: target, isLure: lure });
    }
    return trials;
  },

  _startPractice() {
    this._isPractice = true;
    this._blockLabel = '1-back';
    this._nBack = 1;
    this._currentTrials = this._generateBlock(1, 1, 3);
    this._currentTrialIdx = 0;
    this._allResults = [];
    showScreen('s-nback');
    document.getElementById('nb-status').textContent = 'Practice (1-back)';
    document.getElementById('nb-progress').textContent = '\u2014';
    this._runTrial();
  },

  _startTest() {
    this._isPractice = false;
    this._blockLabel = '1-back';
    this._nBack = 1;
    this._currentTrials = this._generateBlock(1, 2, 8);
    this._currentTrialIdx = 0;
    this._allResults = [];
    showScreen('s-nback');
    document.getElementById('nb-status').textContent = '1-back';
    document.getElementById('nb-progress').textContent = '0 / 8';
    this._runTrial();
  },

  _runTrial() {
    if (this._currentTrialIdx >= this._currentTrials.length) {
      this._finishBlock();
      return;
    }
    const trial = this._currentTrials[this._currentTrialIdx];
    if (!trial.isWarmup) {
      const testIdx = this._allResults.filter(t => !t.is_practice).length + 1;
      const totalTest = 8;
      document.getElementById('nb-progress').textContent = `${testIdx} / ${totalTest}`;
    }
    this._responded = false;
    const stage = document.getElementById('nb-stage');
    stage.innerHTML = `<div class="digit-display pop" style="font-size:7rem">${trial.letter}</div>`;
    this._trialStart = performance.now();
    this._hideTimeoutId = setTimeout(() => {
      if (!this._responded) {
        const s = document.getElementById('nb-stage');
        if (s) s.innerHTML = '<div style="font-size:1rem;color:var(--ink3);user-select:none">\u2014</div>';
      }
    }, this._TSHOW);
    this._onKeyDown = (e) => this._onKeyPress(e);
    document.addEventListener('keydown', this._onKeyDown);
    this._timeoutId = setTimeout(() => this._onTrialEnd(), this._TTL);
  },

  _onKeyPress(e) {
    if (e.code !== 'Space') return;
    e.preventDefault();
    if (this._responded) return;
    this._responded = true;
    this._cleanup();
    const rt = performance.now() - this._trialStart;
    const trial = this._currentTrials[this._currentTrialIdx];
    const correct = trial.isTarget;
    const errType = correct ? 'none' : 'false_alarm';
    this._recordTrial(trial, 'space', Math.round(rt), correct, errType);
    this._advanceAfterResponse();
  },

  _onTrialEnd() {
    this._cleanup();
    if (this._responded) return;
    const trial = this._currentTrials[this._currentTrialIdx];
    const correct = !trial.isTarget;
    const errType = trial.isTarget ? 'miss' : 'none';
    this._recordTrial(trial, '', null, correct, errType);
    this._advanceAfterResponse();
  },

  _advanceAfterResponse() {
    if (this._isPractice) {
      const lastResult = this._allResults[this._allResults.length - 1];
      const trial = this._currentTrials[this._currentTrialIdx];
      if (lastResult && !trial.isWarmup) {
        const stage = document.getElementById('nb-stage');
        stage.innerHTML = `
          <div class="fb-box ${lastResult.correct ? 'fb-correct' : 'fb-wrong'} pop" style="max-width:300px;margin:0 auto">
            <div class="fb-title">${lastResult.correct ? '\u2713 Correct' : '\u2717 Incorrect'}</div>
            ${!lastResult.correct ? `<div style="font-size:.8rem;margin-top:.3rem">It was a <strong>${trial.isTarget ? 'target' : 'non-target'}</strong></div>` : ''}
            <div style="font-size:.78rem;opacity:.75;margin-top:.25rem">Practice \u2014 not scored</div>
          </div>
        `;
      }
      this._currentTrialIdx++;
      if (this._currentTrialIdx >= this._currentTrials.length) {
        setTimeout(() => this._finishBlock(), this._TFB);
      } else {
        setTimeout(() => this._runTrial(), this._TFB);
      }
    } else {
      this._currentTrialIdx++;
      if (this._currentTrialIdx >= this._currentTrials.length) {
        setTimeout(() => this._finishBlock(), 300);
      } else {
        const next = this._currentTrials[this._currentTrialIdx];
        setTimeout(() => this._runTrial(), next.isWarmup ? 0 : 300);
      }
    }
  },

  _recordTrial(trial, response, rtMs, correct, errType) {
    if (trial.isWarmup) return;
    this._allResults.push({
      task: this.id,
      condition: this._blockLabel,
      block: this._blockLabel,
      trial_no: this._allResults.filter(t => !t.is_practice).length + 1,
      level: this._nBack,
      stimulus: trial.letter,
      correct_answer: trial.isTarget ? 'target' : 'non-target',
      response: response || '',
      correct,
      error_type: errType,
      rt_ms: rtMs,
      rt_outlier: false,
      is_practice: this._isPractice,
      position_errors: '',
      timestamp: new Date().toISOString(),
    });
  },

  _finishBlock() {
    if (this._isPractice) {
      const stage = document.getElementById('nb-stage');
      stage.innerHTML = `
        <div style="text-align:center" class="fade-up">
          <div style="font-size:2rem;margin-bottom:.75rem">\u2713</div>
          <h3 style="margin-bottom:.4rem">Practice complete</h3>
          <p style="font-size:.875rem;color:var(--ink2);margin-bottom:1.25rem">You're ready for the real test.</p>
          <button class="btn btn-primary btn-lg" onclick="NBack._startTest()">Start test \u2192</button>
        </div>
      `;
      document.getElementById('nb-status').textContent = 'Ready';
      document.getElementById('nb-progress').textContent = '\u2014';
    } else if (this._blockLabel === '1-back') {
      this._blockLabel = '2-back';
      this._nBack = 2;
      this._currentTrials = this._generateBlock(2, 2, 8);
      this._currentTrialIdx = 0;
      const stage = document.getElementById('nb-stage');
      stage.innerHTML = `
        <div style="text-align:center" class="fade-up">
          <h3 style="margin-bottom:.4rem">1-back complete</h3>
          <p style="font-size:.875rem;color:var(--ink2)">Now moving to <strong>2-back</strong>\u2026</p>
        </div>
      `;
      setTimeout(() => {
        showScreen('s-nback');
        document.getElementById('nb-status').textContent = '2-back';
        document.getElementById('nb-progress').textContent = '0 / 8';
        this._runTrial();
      }, 2000);
    } else {
      this._finish();
    }
  },

  _finish() {
    S.taskActive = false;
    this._cleanup();
    if (this._onComplete) this._onComplete(this._buildResults());
  },

  _buildResults() {
    const real = this._allResults.filter(t => !t.is_practice);
    for (const cond of ['1-back', '2-back']) {
      const ct = real.filter(t => t.condition === cond && t.rt_ms !== null);
      const mean = ct.length ? ct.reduce((s, t) => s + t.rt_ms, 0) / ct.length : 0;
      const sd = ct.length > 1 ? Math.sqrt(ct.reduce((s, t) => s + (t.rt_ms - mean) ** 2, 0) / ct.length) : 0;
      for (const t of ct) t.rt_outlier = t.rt_ms < 200 || t.rt_ms > mean + 3 * sd;
    }
    const block1 = real.filter(t => t.condition === '1-back');
    const block2 = real.filter(t => t.condition === '2-back');
    const s1 = this._computeStats(block1, 1);
    const s2 = this._computeStats(block2, 2);
    return { trials: this._allResults, dPrime1: s1.dPrime, dPrime2: s2.dPrime, block1Stats: s1, block2Stats: s2 };
  },

  _computeStats(trials, nBack) {
    if (!trials.length) return { dPrime: 0, hitRate: 0, faRate: 0, lureFaRate: null, accuracy: 0, meanRT: null, nTargets: 0, nNonTargets: 0, nLures: 0, hits: 0, falseAlarms: 0, lureFAs: 0 };
    const nTrials = trials.length;
    const targets = trials.filter(t => t.correct_answer === 'target');
    const nonTargets = nBack === 2 ? trials.filter(t => t.correct_answer === 'non-target' && !t.isLure) : trials.filter(t => t.correct_answer === 'non-target');
    const lures = trials.filter(t => t.isLure);
    const nTargets = targets.length;
    const nNonTargets = nonTargets.length;
    const nLures = lures.length;
    const hits = targets.filter(t => t.correct).length;
    const falseAlarms = nonTargets.filter(t => !t.correct).length;
    const lureFAs = lures.filter(t => !t.correct).length;
    const hitRate = nTargets ? (hits === 0 ? 0.5 / nTargets : hits === nTargets ? (nTargets - 0.5) / nTargets : hits / nTargets) : 0;
    const faRate = nNonTargets ? (falseAlarms === 0 ? 0.5 / nNonTargets : falseAlarms === nNonTargets ? (nNonTargets - 0.5) / nNonTargets : falseAlarms / nNonTargets) : 0;
    const lureFaRate = nLures ? lureFAs / nLures : null;
    const dPrime = this._probit(hitRate) - this._probit(faRate);
    const correct = trials.filter(t => t.correct).length;
    const accuracy = nTrials ? correct / nTrials * 100 : 0;
    const hitsWithRT = targets.filter(t => t.correct && t.rt_ms !== null && !t.rt_outlier);
    const meanRT = hitsWithRT.length ? hitsWithRT.reduce((s, t) => s + t.rt_ms, 0) / hitsWithRT.length : null;
    return { dPrime, hitRate, faRate, lureFaRate, accuracy, meanRT, nTargets, nNonTargets, nLures, hits, falseAlarms, lureFAs };
  },

  _probit(p) {
    if (p <= 0) p = 0.0001;
    if (p >= 1) p = 0.9999;
    const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239];
    const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
    const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
    const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996, 3.754408661907416];
    let x, q;
    if (p < 0.02425) {
      q = Math.sqrt(-2 * Math.log(p));
      x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    } else if (p < 0.97575) {
      q = p - 0.5;
      x = (((((a[0] * q + a[1]) * q + a[2]) * q + a[3]) * q + a[4]) * q + a[5]) / (((((b[0] * q + b[1]) * q + b[2]) * q + b[3]) * q + b[4]) * q + 1);
    } else {
      q = Math.sqrt(-2 * Math.log(1 - p));
      x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
    }
    return x;
  },
};

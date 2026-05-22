// ── Global state (SPEC §Architecture) ──
const S = {
  pid: '',
  demographics: {},
  deviceMeta: {},
  taskOrder: [],
  taskActive: false,
  results: { digitSpan: null, corsi: null, nback: null, stroop: null },
};
S._taskIdx = 0;

// ── Derived helpers ──
function rng() { return makePRNG(hashStr(S.pid)); }

// ── Screen navigation ──
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(el => el.classList.remove('active'));
  const el = document.getElementById(id);
  if (el) el.classList.add('active');
}

// ── Mobile warning ──
function checkMobile() {
  const mw = document.getElementById('s-mobile-warning');
  const app = document.getElementById('app');
  if (window.innerWidth < 768) {
    mw.classList.add('active');
  } else {
    mw.classList.remove('active');
  }
}
window.addEventListener('resize', checkMobile);
checkMobile();

// ── beforeunload guard ──
window.addEventListener('beforeunload', e => {
  if (S.taskActive) {
    e.preventDefault();
    e.returnValue = '';
  }
});

// ── Welcome / Consent ──
function genPID() {
  document.getElementById('pid').value = 'P' + Math.random().toString(36).slice(2, 7).toUpperCase();
  checkConsent();
}
function checkConsent() {
  const ok = document.getElementById('c1').checked &&
             document.getElementById('c2').checked &&
             document.getElementById('pid').value.trim().length > 0;
  document.getElementById('consent-btn').disabled = !ok;
}

function beginAssessment() {
  S.pid = document.getElementById('pid').value.trim();
  S.deviceMeta = { screen_width: screen.width, screen_height: screen.height, user_agent: navigator.userAgent };
  showScreen('s-demographics');
}

// ── Demographics ──
function checkDemographics() {
  const age = document.getElementById('d-age').value.trim();
  const gender = document.getElementById('d-gender').value.trim();
  const lang = document.getElementById('d-lang').value.trim();
  const sleep = document.getElementById('d-sleep').value.trim();
  const caffeine = document.querySelector('input[name="d-caffeine"]:checked');
  const handedness = document.querySelector('input[name="d-handedness"]:checked');
  const vision = document.querySelector('input[name="d-vision"]:checked');
  document.getElementById('demo-btn').disabled = !(age && gender && lang && sleep && caffeine && handedness && vision);
}
function submitDemographics() {
  S.demographics = {
    age: document.getElementById('d-age').value.trim(),
    gender: document.getElementById('d-gender').value.trim(),
    native_language: document.getElementById('d-lang').value.trim(),
    sleep_hours: document.getElementById('d-sleep').value.trim(),
    caffeine: document.querySelector('input[name="d-caffeine"]:checked').value,
    handedness: document.querySelector('input[name="d-handedness"]:checked').value,
    vision: document.querySelector('input[name="d-vision"]:checked').value,
  };
  shuffleTaskOrder();
  renderTaskMenu();
  showScreen('s-task-menu');
}

// ── Task order (seeded Fisher-Yates shuffle) ──
function shuffleTaskOrder() {
  const prng = makePRNG(hashStr(S.pid));
  const order = ['digitSpan', 'corsi', 'nback', 'stroop'];
  for (let i = order.length - 1; i > 0; i--) {
    const j = Math.floor(prng() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  S.taskOrder = order;
}

const TASK_LABELS = {
  digitSpan: { label: 'Digit Span', desc: 'Phonological working memory — recall digit sequences forward and backward.' },
  corsi: { label: 'Corsi Block-Tapping', desc: 'Visuospatial working memory — tap block sequences in order.' },
  nback: { label: 'N-Back', desc: 'Executive function / updating — detect when a stimulus matches one shown N steps back.' },
  stroop: { label: 'Stroop', desc: 'Inhibition / selective attention — name the ink colour of colour-words.' },
};
const TASK_HEADLINE = {
  digitSpan: (r) => `Forward span: ${r.forwardSpan} / Backward span: ${r.backwardSpan}`,
  corsi: (r) => `Forward span: ${r.forwardSpan} / Backward span: ${r.backwardSpan}`,
  nback: (r) => `2-back d\u2032: ${(r.dPrime2 || 0).toFixed(2)}`,
  stroop: (r) => `Interference: ${(r.interferenceScore || 0).toFixed(0)} ms`,
};

function renderTaskMenu() {
  const list = document.getElementById('tm-list');
  list.innerHTML = S.taskOrder.map(id => {
    const info = TASK_LABELS[id] || { label: id, desc: '' };
    return `<li class="task-item">
      <span class="task-num">${S.taskOrder.indexOf(id) + 1}</span>
      <div><div class="task-name">${info.label}</div><div class="task-desc">${info.desc}</div></div>
    </li>`;
  }).join('');
}

// ── Task registry ──
const TASKS = {
  digitSpan: null, // assigned after DigitSpan definition
};

// ── Battery runner ──
function beginBattery() {
  S._taskIdx = 0;
  runCurrentTask();
}

function runCurrentTask() {
  while (S._taskIdx < S.taskOrder.length) {
    const id = S.taskOrder[S._taskIdx];
    const task = TASKS[id];
    if (task) {
      S.taskActive = true;
      task.run(results => {
        S.results[id] = results;
        S.taskActive = false;
        S._taskIdx++;
        if (S._taskIdx >= S.taskOrder.length) {
          showBatteryResults();
        } else {
          showBreakScreen();
        }
      });
      return;
    }
    S._taskIdx++;
  }
  showBatteryResults();
}

// ── Inter-task break ──
function showBreakScreen() {
  showScreen('s-break');
  const doneId = S.taskOrder[S._taskIdx - 1];
  const doneInfo = TASK_LABELS[doneId] || { label: doneId };
  const nextId = S.taskOrder[S._taskIdx];
  const nextInfo = TASK_LABELS[nextId] || { label: nextId };
  const doneResult = S.results[doneId];
  let headline = '';
  if (doneResult && TASK_HEADLINE[doneId]) {
    headline = TASK_HEADLINE[doneId](doneResult);
  }
  document.getElementById('brk-content').innerHTML = `
    <div class="badge badge-green" style="margin-bottom:1rem;padding:4px 14px">${doneInfo.label} complete</div>
    <h2 style="margin-bottom:${headline ? '.75rem' : '1.25rem'}">Task ${S._taskIdx} of ${S.taskOrder.filter(id => TASKS[id]).length} finished</h2>
    ${headline ? `<div class="stats-grid" style="max-width:280px;margin:0 auto 1.5rem">
      <div class="stat-card"><div class="stat-val" style="font-size:1.2rem">${headline}</div></div>
    </div>` : ''}
    <div class="divider"></div>
    <div style="background:var(--blue-bg);border:1px solid #d0d8f0;border-radius:var(--r-sm);padding:1rem 1.25rem;text-align:left;margin-bottom:1.5rem">
      <strong>Next up: ${nextInfo.label}</strong>
      <p style="margin-top:.4rem;font-size:.875rem">${nextInfo.desc}</p>
    </div>
    <button class="btn btn-primary btn-lg" onclick="runCurrentTask()" style="width:100%">Continue to next task →</button>
  `;
}

// ── Battery results (shell, will be populated in Step 6) ──
function showBatteryResults() {
  S.taskActive = false;
  showScreen('s-results');
  document.getElementById('r-pid').textContent = S.pid;

  // Cross-task summary table
  const tbody = document.getElementById('r-summary-body');
  tbody.innerHTML = '';
  const headlineDefs = [
    { id: 'digitSpan', metric: 'Forward span / Backward span', val: r => r ? `${r.forwardSpan} / ${r.backwardSpan}` : '\u2014' },
    { id: 'corsi', metric: 'Forward span / Backward span', val: r => r ? `${r.forwardSpan} / ${r.backwardSpan}` : '\u2014' },
    { id: 'nback', metric: '2-back d\u2032', val: r => r ? r.dPrime2.toFixed(2) : '\u2014' },
    { id: 'stroop', metric: 'Interference score (ms)', val: r => r ? `${r.interferenceScore.toFixed(0)} ms` : '\u2014' },
  ];
  for (const d of headlineDefs) {
    const info = TASK_LABELS[d.id] || { label: d.id };
    const result = S.results[d.id];
    tbody.innerHTML += `<tr>
      <td style="font-weight:500">${info.label}</td>
      <td style="color:var(--ink2);font-size:.8rem">${d.metric}</td>
      <td style="font-family:var(--mono)">${d.val(result)}</td>
    </tr>`;
  }

  // Cross-task RT & outlier table
  const rtBody = document.getElementById('r-rt-body');
  rtBody.innerHTML = '';
  for (const id of S.taskOrder) {
    const info = TASK_LABELS[id] || { label: id };
    const result = S.results[id];
    if (!result || !result.trials) {
      rtBody.innerHTML += `<tr><td style="font-weight:500">${info.label}</td><td colspan="4" style="color:var(--ink3)">No data</td></tr>`;
      continue;
    }
    const real = result.trials.filter(t => !t.is_practice);
    const withRT = real.filter(t => t.rt_ms !== null);
    const outliers = withRT.filter(t => t.rt_outlier);
    const correct = withRT.filter(t => t.correct && !t.rt_outlier);
    const meanRT = correct.length ? correct.reduce((s, t) => s + t.rt_ms, 0) / correct.length : 0;
    const outPct = withRT.length ? (outliers.length / withRT.length * 100) : 0;
    rtBody.innerHTML += `<tr>
      <td style="font-weight:500">${info.label}</td>
      <td style="font-family:var(--mono)">${meanRT.toFixed(0)}</td>
      <td style="font-family:var(--mono)">${withRT.length}</td>
      <td style="font-family:var(--mono)">${outliers.length}</td>
      <td><span class="badge ${outPct > 10 ? 'badge-amber' : 'badge-blue'}">${outPct.toFixed(1)}%</span></td>
    </tr>`;
  }

  // Per-task detail panels
  const panels = document.getElementById('r-task-panels');
  panels.innerHTML = '';
  for (const id of S.taskOrder) {
    const task = TASKS[id];
    const result = S.results[id];
    if (task && result && task.renderResults) {
      const detail = document.createElement('details');
      const info = TASK_LABELS[id] || { label: id };
      detail.innerHTML = `<summary>${info.label} — detailed results</summary>`;
      const div = document.createElement('div');
      div.style.cssText = 'margin-top:.75rem';
      task.renderResults(result, div);
      detail.appendChild(div);
      panels.appendChild(detail);
    }
  }
}

// ── CSV Export (SPEC data model) ──
function downloadCSV() {
  const sessionMeta = getSessionMeta();
  const header = Object.keys(sessionMeta).join(',') +
    ',task,condition,block,trial_no,level,stimulus,correct_answer,response,correct,error_type,rt_ms,rt_outlier,is_practice,position_errors,timestamp';
  const metaVals = Object.values(sessionMeta);
  let rows = [];
  for (const id of S.taskOrder) {
    const task = TASKS[id];
    const results = S.results[id];
    if (task && results && task.getCSVRows) {
      const taskRows = task.getCSVRows(results, sessionMeta);
      for (const r of taskRows) {
        rows.push([...metaVals,
          r.task, r.condition, r.block || '', r.trial_no, r.level,
          r.stimulus, r.correct_answer, r.response || '',
          r.correct ? 1 : 0, r.error_type, r.rt_ms,
          r.rt_outlier ? 1 : 0, r.is_practice ? 1 : 0,
          r.position_errors || '', r.timestamp,
        ].join(','));
      }
    }
  }
  if (!rows.length) return;
  const blob = new Blob([[header, ...rows].join('\n')], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cognitive_battery_${S.pid}_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click(); URL.revokeObjectURL(a.href);
}

function downloadJSON() {
  const sessionMeta = getSessionMeta();
  let allTrials = [];
  for (const id of S.taskOrder) {
    const task = TASKS[id];
    const results = S.results[id];
    if (task && results && task.getCSVRows) {
      allTrials = allTrials.concat(task.getCSVRows(results, sessionMeta));
    }
  }
  if (!allTrials.length) return;
  const payload = {
    sessionMeta: {
      pid: S.pid,
      demographics: S.demographics,
      deviceMeta: S.deviceMeta,
      taskOrder: S.taskOrder,
      exportedAt: new Date().toISOString(),
    },
    trials: allTrials,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `cognitive_battery_${S.pid}_${new Date().toISOString().slice(0, 10)}.json`;
  a.click(); URL.revokeObjectURL(a.href);
}

// ── Restart ──
function restartAll() {
  Object.assign(S, {
    pid: '', demographics: {}, deviceMeta: {}, taskOrder: [], taskActive: false,
    results: { digitSpan: null, corsi: null, nback: null, stroop: null },
    _taskIdx: 0,
  });
  DigitSpan._reset();
  Stroop._reset && Stroop._reset();
  Corsi._reset && Corsi._reset();
  NBack._reset && NBack._reset();
  showScreen('s-welcome');
}

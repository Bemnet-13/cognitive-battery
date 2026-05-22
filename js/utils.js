// ── Seeded RNG (mulberry32) ──
function hashStr(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (((h << 5) + h) + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
function makePRNG(seed) {
  let s = seed | 0;
  return () => {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = t + Math.imul(t ^ (t >>> 7), 61 | t) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ── Inverse normal CDF (for d-prime calculation) ──
function probit(p) {
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
}

// ── Task badge helper ──
function getTaskBadge(id) {
  const pos = S.taskOrder.indexOf(id) + 1;
  const total = S.taskOrder.filter(tid => TASKS[tid]).length;
  return total > 0 ? `Task ${pos} of ${total}` : '';
}

// ── Session metadata (for CSV/JSON export) ──
function getSessionMeta() {
  return {
    participant_id: S.pid,
    age: S.demographics.age || '',
    gender: S.demographics.gender || '',
    native_language: S.demographics.native_language || '',
    sleep_hours: S.demographics.sleep_hours || '',
    caffeine: S.demographics.caffeine || '',
    handedness: S.demographics.handedness || '',
    vision: S.demographics.vision || '',
    screen_width: S.deviceMeta.screen_width || '',
    screen_height: S.deviceMeta.screen_height || '',
    user_agent: S.deviceMeta.user_agent || '',
  };
}

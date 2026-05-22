# Cognitive Battery — SPEC

Single HTML file, vanilla JS, no build step. Expands the existing Digit Span task into a 4-task working-memory + executive-function battery.

---

## Theoretical frame

| Task | Component | Key citation |
|---|---|---|
| Digit Span | Phonological loop, updating | Baddeley & Hitch (1974); Wechsler (2008) |
| Corsi Block-Tapping | Visuospatial sketchpad | Milner (1971); Kessels et al. (2000) |
| N-Back | Central executive / WM updating | Kirchner (1958); Jaeggi et al. (2008) |
| Stroop | Inhibition / selective attention | Stroop (1935); MacLeod (1991) |

---

## App flow

```
Welcome → Consent → Demographics → Task menu
  → Task → Break → Task → Break → Task → Break → Task
  → Combined results dashboard → Export
```

Task order: simple seeded randomization keyed off participant ID hash (mulberry32 — already in codebase).

---

## Device & environment

- **Desktop-first.** On viewport width < 768px show a full-screen warning: "Please open this on a desktop or laptop browser."
- **Session persistence:** hard restart on page refresh. No `localStorage`. Add `beforeunload` warning when a task is actively running (`S.taskActive = true`).

---

## Architecture

### Task interface

Every task exports this object:

```js
const TaskName = {
  id: 'stroop',            // machine key, used in CSV
  label: 'Stroop',         // display name
  showInstructions(onReady),          // renders instructions screen, calls onReady when participant clicks start
  run(onComplete),                    // runs trials, calls onComplete(results)
  getCSVRows(results, sessionMeta),   // returns array of flat row objects
  renderResults(results, container),  // renders dashboard section into container
};
```

### Global state

```js
const S = {
  pid: '',
  demographics: {},       // see Demographics below
  deviceMeta: {},         // screen_width, screen_height, user_agent
  taskOrder: [],          // shuffled array of task ids
  taskActive: false,      // true while a task is running (for beforeunload)
  results: {
    digitSpan: null,
    corsi: null,
    nback: null,
    stroop: null,
  },
};
```

### Shared infrastructure

- Seeded RNG: mulberry32, existing implementation, keyed off `hashStr(S.pid)`.
- Screen navigation: `showScreen(id)`.
- Unified CSV + JSON builder called from results dashboard.
- `rt_outlier` flagging: computed per participant per task per condition after all trials complete. Flag = `true` if `rt_ms < 200` or `rt_ms > mean + 3·SD`.

---

## Demographics

Collected on a single screen after consent. All fields required before proceeding.

| Field | Input type | CSV column |
|---|---|---|
| Age | Number input | `age` |
| Gender | Text input (free) | `gender` |
| Native language | Text input (free) | `native_language` |
| Sleep last night | Number input (hours, 0–24) | `sleep_hours` |
| Caffeine last 2h | Radio yes/no | `caffeine` |
| Handedness | Radio left/right/ambidextrous | `handedness` |
| Vision correction | Radio normal/corrected-to-normal | `vision` |

---

## Data model

One flat trial log. Every row includes all columns below. Demographics and device metadata repeat on every row.

```
participant_id, task, condition, block, trial_no, level,
stimulus, correct_answer, response, correct, error_type, rt_ms,
rt_outlier, is_practice, position_errors, timestamp,
age, gender, native_language, sleep_hours, caffeine, handedness, vision,
screen_width, screen_height, user_agent
```

- `position_errors`: comma-separated 0/1 bitmask per serial position. Only populated for Digit Span trials; empty string for other tasks.
- `rt_outlier`: boolean. Computed post-task, written at export time.
- `error_type`: `none` | `transposition` | `substitution` | `length` | `timeout` | `false_alarm` | `miss`.
- `is_practice`: boolean. Practice trials are included in the log but excluded from all scoring and dashboard stats.
- `block`: used by N-Back (1-back / 2-back). Empty string for tasks without blocks.
- `level`: span length for Digit Span / Corsi; N level for N-Back; empty for Stroop.

### Timeout behavior

| Task | Timeout | On timeout |
|---|---|---|
| Digit Span | 30s from input reveal | `correct = false`, `rt_ms = null`, `error_type = 'timeout'`, advance |
| Corsi | 30s from input reveal | same |
| N-Back | 2s from stimulus onset | same |
| Stroop | 4s from stimulus onset | same |

---

## Export

Both exports available on the results dashboard.

- **CSV**: flat trial log, one row per trial, demographics + device metadata on every row.
- **JSON**: `{ sessionMeta: { pid, demographics, deviceMeta, taskOrder, exportedAt }, trials: [...] }`.
- Filename pattern: `cognitive_battery_<pid>_<YYYY-MM-DD>.(csv|json)`.
- Practice trials included in export with `is_practice: true` so researchers can verify/exclude.

---

## Task 1 — Digit Span (refactor of existing)

Behavior is unchanged. Refactor only: wrap existing logic in the task interface above.

### Parameters
- Forward: spans 3–9, 2 trials/level, advance on ≥ 1/2 correct.
- Backward: spans 2–8, same staircase.
- Digit display: 750ms on, 300ms ISI, 900ms fixation.
- Input timeout: 30s.
- Practice: 2 forward trials at span 3. Practice button hidden for backward (same as current).

### Schema additions
- `position_errors`: bitmask string, e.g. `"1,0,1,0"` (1 = correct position, 0 = error). Computed by comparing `response` digits position-by-position against `correct_answer`.

### Dashboard (existing + serial position curve)
- Forward span, backward span, raw score, mean RT.
- Accuracy by span length table.
- RT by span length chart (existing).
- Serial position curve: % correct per ordinal position, averaged across all forward trials and all backward trials separately.
- Error type breakdown: transposition / substitution / length.

---

## Task 2 — Corsi Block-Tapping

### Layout
- 9 blocks, Kessels et al. (2000) standardized irregular positions, scaled to a fixed 480×480px canvas.
- Blocks: 48×48px squares, rounded corners, same surface/border styling as the rest of the app.
- Block positions (normalized 0–1, scale to canvas): use published Kessels coordinates.

### Parameters
- Forward: spans 2–8, 2 trials/level, advance on ≥ 1/2 correct.
- Backward: spans 2–8, same staircase.
- Sequence presentation: each block highlights for 800ms, 400ms ISI between blocks.
- Recall: participant clicks blocks in order (forward) or reverse order (backward).
- Tap feedback: 100ms highlight on click to confirm input registered. No persistent highlight.
- Input timeout: 30s from end of sequence presentation.
- Practice: 2 trials at span 2 (forward only).

### Scoring
- Span = longest sequence length where ≥ 1 of 2 trials correct (same as Digit Span).
- Kessels total score = sum of all correct trials across all levels (report alongside span).

### Dashboard
- Forward span, backward span, Kessels total score.
- Accuracy by span length table.
- RT by span length chart.

---

## Task 3 — N-Back

### Parameters
- Conditions: 1-back block, then 2-back block.
- Stimuli: consonants — B, F, H, J, K, L, M, P, Q, R, T, V.
- Trial structure: 500ms stimulus (letter displayed center screen, large mono font) + 1500ms ISI (blank) = 2000ms total. Response window = full 2000ms from stimulus onset.
- Block length: 2 warm-up trials (not scored, not logged) + 20 test trials.
- Target rate: 30% (6 targets per 20-trial block).
- Lures: N±1 back items. In a 2-back block, lures are letters that appeared exactly 1 or 3 positions ago. Lure rate: ~15% of trials. Lures are non-targets; lure false alarm rate reported separately.
- Response: spacebar = target (Go). No response = non-target (No-go).
- Timeout: 2s from stimulus onset. No response = miss (`error_type = 'miss'`).
- Practice: 5 trials at 1-back with visual feedback after each trial.

### Scoring (per block)
- Hit = target, spacebar pressed.
- Miss = target, no response.
- False alarm = non-target, spacebar pressed.
- Correct rejection = non-target, no response.
- Lure false alarm = lure trial, spacebar pressed (reported separately, not counted in main FA rate).
- d′ = Z(hit rate) − Z(FA rate). Apply 0.5 correction for hit/FA rates of 0 or 1.
- Report: d′, hit rate, FA rate, lure FA rate, accuracy, mean RT (hits only).

### Dashboard
- Per block (1-back, 2-back): d′, hit rate, FA rate, lure FA rate, accuracy, mean RT.
- RT distribution note: RT for N-Back is measured from stimulus onset, not from a separate input-reveal event.

---

## Task 4 — Stroop

### Parameters
- Colors: red, blue, green, yellow.
- Conditions: congruent (word and ink match), incongruent (word and ink conflict), neutral (color-unrelated word in colored ink — use: TABLE, CHAIR, HOUSE, PLANT).
- Trials: 24 per condition = 72 total, randomly interleaved.
- Stimulus: color word (or neutral word) displayed center screen, large serif font, in the ink color.
- Response: keyboard — R = red, B = blue, G = green, Y = yellow. Key labels shown on-screen below stimulus.
- Timeout: 4s from stimulus onset.
- Practice: 6 trials (2 per condition, randomized) with correctness feedback after each.
- Inter-trial interval: 500ms blank screen between trials.

### Scoring
- Accuracy per condition.
- Mean RT per condition (correct trials only, outliers flagged).
- Interference score = mean RT incongruent − mean RT congruent.
- Facilitation score = mean RT congruent − mean RT neutral.
- Net Stroop effect = mean RT incongruent − mean RT neutral.

### Dashboard
- Mean RT by condition (bar chart or table).
- Accuracy by condition.
- Interference score, facilitation score, net Stroop effect.

---

## Results dashboard

Shown after all 4 tasks complete.

### Cross-task summary table (top)
One row per task, headline DV:

| Task | Metric | Value |
|---|---|---|
| Digit Span | Forward span / Backward span | — |
| Corsi | Forward span / Backward span | — |
| N-Back | 2-back d′ | — |
| Stroop | Interference score (ms) | — |

### Per-task sections
Collapsible `<details>` panels, one per task, containing the full dashboard described per task above.

### Export buttons
"Download CSV" and "Download JSON" — both in the header of the results screen.

---

## Inter-task breaks

Break screen shown after each task (except after the last).

Content:
- Task name + completion badge.
- Headline metric for the just-completed task (span, d′, or interference score).
- Brief plain-language label (e.g. "Forward span: 7 *(longer sequences = stronger phonological memory)*").
- "Continue to next task →" button. No forced wait.

---

## Practice summary

| Task | Trials | N level / Span | Feedback |
|---|---|---|---|
| Digit Span | 2 | Span 3, forward | Correct/incorrect + answer shown |
| Corsi | 2 | Span 2, forward | Correct/incorrect |
| N-Back | 5 | 1-back | Correct/incorrect after each trial |
| Stroop | 6 | 2 per condition | Correct/incorrect + correct color shown |

All practice trials: `is_practice = true`, excluded from scoring and dashboard.

---

## Build order

1. **Refactor Digit Span** into task interface. No behavior change. Add `position_errors` column.
2. **Shell**: welcome → consent → demographics → task menu → break screens → results shell. Counterbalancing. `beforeunload` guard. Mobile warning.
3. **Stroop** task.
4. **Corsi** task.
5. **N-Back** task.
6. **Combined results dashboard** + serial position curve + unified CSV/JSON export + `rt_outlier` flagging.
7. **Polish**: keyboard accessibility, edge cases, cross-browser check.

Each step leaves the app in a working state.

---

## Aesthetic

Same as existing Digit Span: cream background (`#f2efe9`), IBM Plex Mono for digits/stimuli/data, Lora for headings, DM Sans for body. Existing CSS variables, card/button/badge components reused throughout.

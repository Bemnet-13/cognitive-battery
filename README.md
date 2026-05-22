# Cognitive Assessment Battery

A browser-based cognitive assessment battery with four standardised tasks measuring working memory, executive function, and selective attention.

## Tasks

| Task | Construct | Description |
|------|-----------|-------------|
| **Digit Span** | Phonological working memory | Recall digit sequences forward and backward (staircase: span 3→9 / 2→8) |
| **Corsi Block-Tapping** | Visuospatial working memory | Tap block sequences in forward and reverse order (Kessels 2000 layout) |
| **N-Back** | Executive function / updating | Detect when a letter matches one shown N steps back (1-back → 2-back, d′ scoring) |
| **Stroop** | Inhibition / selective attention | Name the ink colour of colour-words (congruent / incongruent / neutral) |

## How to run

Open `index.html` in any modern desktop browser:

```
index.html
```

No build step, no server, no dependencies required — it is a single-page application that runs entirely client-side.

### Standalone task

`digit-span-task.html` is an older standalone version of the Digit Span task preserved for reference.

## Usage

1. **Participant ID** — auto-generated or entered manually on the consent screen
2. **Demographics** — age, gender, native language, sleep, caffeine, handedness, vision (all required)
3. **Task menu** — shows the randomised task order (seeded by participant ID)
4. **Tasks** — run sequentially with short breaks between them; each has a practice round
5. **Results** — cross-task summary table, RT/outlier table, and per-task detail panels (expandable)

### Export

- **CSV** — trial-level data with session metadata for all tasks
- **JSON** — full results payload with session and trial data

### Notes

- **Desktop only** — a warning is shown on viewports < 768px wide
- **No persistence** — data lives in memory only; refresh = restart. Export before closing.
- **Task order** is deterministic given the same participant ID (seeded shuffle)

## File structure

```
├── index.html                 HTML screens
├── css/style.css              Styles
├── js/
│   ├── utils.js               Utilities (RNG, probit, helpers)
│   ├── app-shell.js           Global state, navigation, battery runner, export
│   ├── task-digit-span.js     Digit Span task
│   ├── task-stroop.js         Stroop task
│   ├── task-corsi.js          Corsi Block-Tapping task
│   ├── task-nback.js          N-Back task
│   └── init.js                Task registration and initialisation
└── digit-span-task.html       Standalone Digit Span (preserved)
```

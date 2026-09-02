# AGENTS.md

Pac-Man clone in vanilla JS/HTML/CSS. Learning project for spec-driven development. No build system, no package manager, no tests, no linter, no CI.

## Run / verify

Open `src/index.html` directly in a browser (plain scripts and CSS, so `file://` works — no server needed). There is no other verification step; changes are verified by playing.

## Architecture (critical)

- No ES modules, no bundler. `src/index.html` loads plain `<script>` tags in a strict order that must be preserved: `maze.js` → `game.js` → `render.js` → `main.js`.
- Files communicate via globals attached to `window` at the bottom of each file (e.g. `window.MAZE`, `window.createGame`, `window.draw`). Do not introduce imports/exports — follow the existing global pattern.
- `maze.js`: 28×31 maze written as 31 strings of 28 chars, parsed to a numeric matrix. Cell values: `0` empty, `1` wall, `2` dot, `3` ghost-pen door. Symmetric across the vertical center axis; row 14 is the wrap-around tunnel.
- `MAZE` is pristine and read-only — never mutate it. `createGame()` copies it into `game.grid`; all mutation (dots eaten) and rendering use `game.grid`.
- `main.js` owns the loop, keyboard input, and overlay screens; it consumes `createGame`/`update`/`draw`.
- Canvas size is hardcoded as `560×620` in `index.html` = 28×`TILE` by 31×`TILE` with `TILE = 20` in `render.js`. If maze dimensions change, update the canvas size too.

## Workflow: spec-driven development

Features are driven by specs, not coded directly:

1. `/spec <description>` — designs and saves `specs/NN-slug.md` in Draft state. No code is written in this phase.
2. The human reviews the spec and flips its state to Approved (only the human does this).
3. `/spec-impl NN-slug` — validates the Approved state, creates/switches to branch `spec-NN-slug`, and implements the plan step by step, pausing for diff review. Never commits automatically.

Full rules: `.agents/skills/spec/SKILL.md` and `.agents/skills/spec-impl/SKILL.md`.

## Conventions

- Comments, UI text, and specs are in Spanish ("GANASTE", "VIDAS"). Keep new code comments in Spanish.
- Code style: spaces inside parentheses `( x )`, single quotes, 2-space indent. Mimic existing files.

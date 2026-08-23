## 1. Project setup

- [x] 1.1 Remove `main.py`, `pyproject.toml`, `.python-version`; replace `.gitignore` with a Node/Vite one (keep `.superpowers/`)
- [x] 1.2 Initialise `package.json` (private, no `dependencies`), install dev deps: `vite`, `typescript`, `vitest`, `eslint` + `typescript-eslint`, `@playwright/test`; commit lockfile
- [x] 1.3 Add `tsconfig.json` (strict, `noUncheckedIndexedAccess`), `vite.config.ts` (`base: '/'`), `vitest.config.ts`, `eslint.config.js` with a `no-restricted-properties` rule banning `Math.random` under `src/core/**`
- [x] 1.4 Create `index.html`, `src/main.ts` stub, `src/core/`, `src/ui/`, `src/i18n/`, `src/theme/`, `src/audio/` directories; verify `npm run dev`, `npm run build`, `npm test` all run green on the stub
- [x] 1.5 Add npm scripts: `dev`, `build`, `preview`, `typecheck`, `lint`, `test`, `test:e2e`

## 2. Core: wall, RNG, parcels, schedule

- [x] 2.1 `core/rng.ts`: FNV-1a 32-bit hash of a string, mulberry32 with explicit state, `next(state) → [value, state]`, `pick`, `shuffle`; unit tests for determinism
- [x] 2.2 `core/wall.ts`: `Size`, `Slot`, `buildWall(columns)`, `fits(parcelSize, slotSize)`; tests for 2/3/5 columns and fit matrix
- [x] 2.3 `core/parcel.ts`: `Parcel` type, colour/sticker enums, `generateParcels(rngState, profile)` with unique codes, look-alike pairs, feasible size mix; tests for uniqueness, determinism, pairs, feasibility
- [x] 2.4 `core/profiles.ts`: `DayProfile` type and the `daily` profile (3 cols, 16 pickups, 4 senders, 2 pairs, 25 s / 65 s, patience 20 s)
- [x] 2.5 `core/schedule.ts`: `buildSchedule(rngState, profile, parcels)` → sorted arrivals (pickups + senders with `needsSize`) over the first 50 s of SERVE; tests for determinism, counts, ordering

## 3. Core: reducer and scoring

- [x] 3.1 `core/game.ts`: `State`, `Action` (`start`, `tick`, `tapSlot`, `selectCustomer`, `continue`), `initialState(seed, profile)`, `reduce` skeleton with phase guard; test phase order
- [x] 3.2 LOAD: queue, placement validation, timer expiry, unplaced accounting, early completion; tests for valid/invalid placement and both exits
- [x] 3.3 SERVE arrivals and queue: visible/pending split, default active, `selectCustomer`; tests
- [x] 3.4 SERVE pickup service: correct door → `open` → `empty` after `doorMs`, wrong tap accounting, per-slot outcome; tests
- [x] 3.5 Hint ladder: mistake- and time-based levels, column marking, reset on active change; tests for 6 s / 12 s and second mistake
- [x] 3.6 Sender service: fit check, `outgoing` placement, wrong tap; tests
- [x] 3.7 Patience: drain for visible customers, walk handling for pickups (`expired`) and senders (`refused`); SERVE end on timer or empty queue with remaining customers walking; tests
- [x] 3.8 SWEEP: marking, clearing, skip when nothing marked, transition to SUMMARY; tests
- [x] 3.9 `core/score.ts`: service points with speed multiplier, penalties, zero floor, total time; wire into reducer; tests per formula
- [x] 3.10 Summary assembly (`served, hinted, walked, refused, unplaced, wrongTaps, slotOutcomes, score, timeMs`) and the replay-determinism test
- [x] 3.11 Scripted-day fixtures: three `{ seed, actions[] }` logs (perfect day, hinted day, walked/refused day) with snapshot summaries

## 4. Core: daily, share, storage, i18n

- [x] 4.1 `core/daily.ts`: UTC date string, seed derivation, Daily number from `LAUNCH_EPOCH`, streak and best computation from records; tests for streak continue/break and epoch day
- [x] 4.2 `core/share.ts`: emoji grid from slot outcomes in wall order (one line per column), share text builder; tests for shape, mapping, PL/EN header and `m:ss` formatting
- [x] 4.3 `storage.ts`: `pk:v1:` namespace, JSON get/set, try/catch with in-memory fallback, corrupt-value tolerance; tests with a throwing `localStorage` stub
- [x] 4.4 `i18n/pl.ts`, `i18n/en.ts`, `i18n/index.ts` (`t`, `setLang`, `detectLang`); key-parity test; brand-name scan test; hint-line builders for colour/sticker

## 5. UI and theme

- [ ] 5.1 `theme/tokens.css`: all tokens on `:root` (colours, door colours per state, parcel colour tokens, radius, font, shadow, `--motion`, `--unit`), `prefers-reduced-motion` override; `theme/signage.css` for `[data-theme="signage"]`; bundle Inter woff2 (latin + latin-ext) under `public/fonts/`
- [ ] 5.2 Static DOM skeleton in `index.html`: app root, screens (`title`, `howto`, `game`, `result`), `scenery` div, wall grid, screen panel, HUD, customer queue, parcel queue
- [ ] 5.3 `ui/wall.ts`: build door buttons from `buildWall`, CSS grid placement via `grid-row: span`, `data-*` attributes, accessible labels, enlarged hit areas; responsive rule for screen-panel placement (<640 px above, else central column)
- [ ] 5.4 `ui/render.ts`: diff previous vs next state and update only changed `data-*` attributes/text for doors, parcel queue, customer queue, screen panel, HUD timers; `ui/input.ts` mapping pointer events on doors/customers/buttons to actions
- [ ] 5.5 `ui/screen.ts`: active customer display (code, hint line, hint level visuals: swatch + sticker, column highlight), sender request, patience bars
- [ ] 5.6 `ui/hud.ts`: phase label, clock (SERVE shown as 08:00→20:00), score, remaining parcels, mute + language toggles
- [ ] 5.7 Screens: title (Daily button, how-to, streak, toggles), how-to (three steps, localised), result (Daily number/date, score, time, grid, streak, best, share, practice-again, practice labelling)
- [ ] 5.8 `main.ts` game loop: rAF tick dispatch, screen routing, Daily start/finish wiring to `daily.ts` and storage (first-attempt-counts, practice counter)
- [ ] 5.9 Share button: `navigator.share` → clipboard → textarea chain with localised confirmation
- [ ] 5.10 Language toggle re-render without state reset; theme attribute set from storage at boot (`signage` only)
- [ ] 5.11 Manual pass on 360×640, 390×844 and 1280×800 viewports: no scrolling, all doors visible, hit areas verified

## 6. Audio

- [ ] 6.1 `audio/sfx.ts`: gesture-gated `AudioContext`, synthesised `tap`, `door`, `wrong`, `done`; mute respected before context creation
- [ ] 6.2 Wire cues to reducer feedback flags in `render.ts`; mute toggle persisted

## 7. Quality gates

- [ ] 7.1 Test that scans `src/core` and `src/ui` for colour literals and fails on any match
- [ ] 7.2 Playwright smoke test against `vite preview` of `dist/`: title → Daily → place one parcel → idle to result → share button visible
- [ ] 7.3 ESLint clean, `tsc --noEmit` clean, all unit tests green

## 8. Deploy and docs

- [ ] 8.1 `public/CNAME` (`paczkom.at`), `public/manifest.webmanifest`, favicon and icons; verify they appear in `dist/`
- [ ] 8.2 `.github/workflows/ci.yml`: typecheck, lint, unit tests, build, Playwright smoke (Chromium) on push and PR
- [ ] 8.3 `.github/workflows/deploy.yml`: on push to `main` after CI, `upload-pages-artifact` + `deploy-pages`
- [ ] 8.4 Set `LAUNCH_EPOCH` to the launch date
- [ ] 8.5 `README.md`: prerequisites, install, dev, test, build, deploy, GitHub Pages + DNS setup for `paczkom.at`, trademark note on wording
- [ ] 8.6 Enable GitHub Pages (source: Actions) and custom domain in repo settings; confirm the site loads at `paczkom.at` (owner action, documented in README)

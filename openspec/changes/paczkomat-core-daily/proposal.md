## Why

paczkom.at is an owned domain with nothing on it. The name is a one-glance pun on "paczkomat" (parcel locker), which argues for a small, polished browser game where the locker wall *is* the screen — something a visitor understands in five seconds and enjoys for two minutes. This change builds the game engine, the shareable Daily mode, and the deployment so the domain goes live with a complete, replayable experience. The escalating Week mode is deferred to a second change so the core loop can ship and be validated first.

## What Changes

- Replace the empty Python scaffold (`main.py`, `pyproject.toml`, `.python-version`, Python `.gitignore`) with a Vite + TypeScript static web project, zero runtime dependencies.
- Add the game engine: a pure, deterministic reducer (`core/`) driving a locker wall of A/B/C slots, seeded parcel generation, and a three-phase day (LOAD → SERVE → SWEEP) with customers who pick up or send parcels.
- Add a hint ladder so a player is never stuck: wrong door reveals the parcel's colour, second wrong door highlights the column.
- Add scoring (speed-weighted points, penalties) — reputation/fail state is deferred to the Week change.
- Add **Daily mode** ("Dzisiaj"): one seeded day per UTC date, identical for every player, first attempt counts, practice replays allowed, streak tracking.
- Add a **share card**: one emoji per slot in wall order plus score/time, via Web Share API with clipboard and visible-text fallbacks.
- Add bilingual UI (Polish default, English toggle, browser-language auto-detect).
- Add a token-based theming layer with a single "signage" theme, a scenery slot reserved for future themes, and `prefers-reduced-motion` support.
- Add synthesised WebAudio sound effects (no audio assets) with a mute toggle.
- Add `localStorage` persistence (language, theme, mute, streak, best, today's attempt) with an in-memory fallback.
- Add the site shell: title screen, how-to-play screen, daily-result screen, PWA manifest, favicon.
- Add CI (typecheck, lint, unit tests, build, smoke test) and GitHub Pages deployment on push to `main` with the custom domain `paczkom.at`.
- Rewrite `README.md` with setup, run, test, and deploy instructions.

## Capabilities

### New Capabilities
- `locker-wall`: slot layout per column count, slot sizes A/B/C (1:2:4), fit rules, door states, viewport-fitting layout on phones and desktops.
- `parcel-generation`: seeded generation of parcels with size, 4-digit code, colour, sticker; look-alike code pairs; deterministic per seed.
- `day-loop`: LOAD / SERVE / SWEEP phase state machine, timers advanced by ticks, customer queue (pickups and senders), patience, hint ladder, tap-to-place and tap-door input semantics, day summary.
- `scoring`: per-customer points with speed multiplier, wrong-tap and refused-sender penalties, unplaced-parcel penalties, day score.
- `daily-mode`: UTC-date seed, fixed difficulty profile, first-attempt-counts rule, practice replays, streak and best tracking, result screen.
- `share-card`: emoji grid derived from final slot outcomes, share text format, Web Share → clipboard → visible text fallback chain.
- `i18n`: Polish/English string catalogues, auto-detection, persisted toggle, language-independent game state.
- `theming`: CSS custom-property tokens, `data-theme` switching, signage theme, scenery slot, reduced-motion behaviour, no colour knowledge in game code.
- `persistence`: `localStorage` wrapper with versioned keys, in-memory fallback when storage is unavailable.
- `audio-feedback`: synthesised click / thunk / buzz / chime cues, mute toggle, no playback before first user gesture.
- `site-shell`: title, how-to, and result screens; PWA manifest; favicon; GitHub Pages deployment with custom domain; CI gates.

### Modified Capabilities
<!-- none: no existing specs -->

## Impact

- **Repo**: Python files removed; `package.json`, `vite.config.ts`, `tsconfig.json`, `eslint` config, `vitest` and `playwright` configs, `src/`, `public/`, `.github/workflows/` added. `.gitignore` switched to Node.
- **Dependencies**: dev-only — `vite`, `typescript`, `vitest`, `eslint` (+ TS plugin), `@playwright/test`. No runtime dependencies.
- **Infrastructure**: GitHub Pages enabled on the repo; DNS for `paczkom.at` (apex A/AAAA to GitHub Pages, `www` CNAME) configured by the owner outside this repo.
- **Follow-up change**: `paczkomat-week-mode` adds the seven-day run, mid-day events (jammed door, forgotten code, rain, late van), reputation fail state, and raises Daily to its full difficulty profile. This change must leave `core/schedule.ts` and the reducer extensible for those events.
- **Trademark note**: "Paczkomat" is InPost's registered mark. In-game copy uses "automat paczkowy" / "parcel locker"; no InPost colours or logo.

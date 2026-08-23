## Context

The repository is an empty `uv` Python scaffold with OpenSpec configured; there is no application code. The product is a browser game for the owned domain `paczkom.at`: the player alternates between loading a parcel locker as the courier and serving customers as the locker's "memory". Decisions below were reached in a brainstorming session (2026-08-23) and are restated here so the change is self-contained.

Fixed decisions from that session:

- Concept A: one in-game day = LOAD → SERVE → SWEEP; both roles; Daily mode with a shareable emoji grid; Week mode later.
- Mobile is first-class; input is tap-to-select / tap-to-place only; the whole wall is always visible (spatial memory is the core skill).
- Bilingual: Polish default, English toggle.
- Look: theme "C · Signage" (off-white, black, one vermilion accent, typography-led, no scenery) for v1; themes "Dusk vector" and "Cozy pixel" later via a theme picker — so v1 must be token-driven.
- Stack: Vite + TypeScript + DOM, no game engine, no framework, no backend, zero runtime dependencies.
- Hosting: GitHub Pages with the custom domain.

## Goals / Non-Goals

**Goals:**

- A complete, polished Daily mode playable on a phone in ~2 minutes, live at `https://paczkom.at`.
- A deterministic, replayable game core that the Week change can extend with events and reputation without restructuring.
- A theming layer where a new theme is CSS only.
- A CI gate that keeps the site from shipping broken.

**Non-Goals:**

- Week mode, mid-day events (jammed door, forgotten code, rain, late van), reputation/fail state — change `paczkomat-week-mode`.
- Leaderboards, accounts, analytics, any server component.
- Drag-and-drop input, physics, particle effects.
- Themes other than Signage (tokens are prepared; the picker UI is not built).
- Audio assets (all sound is synthesised).

## Decisions

### D1. Pure reducer core, imperative DOM view

`core/` exports `reduce(state, action): State` and is free of DOM, timers, and `Math.random`. `ui/render.ts` diffs the new state against the previous one and writes `data-*` attributes on a stable DOM tree (one `<button>` per slot, one panel for the screen, one HUD). Time enters the reducer only through `tick(dtMs)` actions driven by `requestAnimationFrame`.

*Why:* a day is reproducible from `seed + action log`, which gives headless regression tests for the entire loop and makes the Week change a matter of adding actions and schedule entries. *Alternatives:* Phaser (Canvas rendering fights CSS theming and crisp text on a grid; ~1 MB), a reactive framework (a 40-node grid does not need one; adds a runtime dependency).

### D2. Determinism: mulberry32 seeded from an FNV-1a hash

`core/rng.ts` implements mulberry32 with the RNG state stored *inside* `State` (so reducing is pure). Daily seed = FNV-1a 32-bit hash of the UTC date string `YYYY-MM-DD`. Practice replays reuse the same seed, so practising the Daily means replaying the identical day. An ESLint `no-restricted-properties` rule bans `Math.random` under `src/core/`.

### D3. Wall geometry

A column is 12 units tall: 4×A (1 unit) + 2×B (2 units) + 1×C (4 units), laid out top-to-bottom A A A A B B C. The Daily profile in this change uses **3 columns** (21 slots: 12 A, 6 B, 3 C). Slots are identified `c{col}r{index}` and carry `size`, `col`, `row` (unit offset), and `span`. Fit rule: a parcel fits a slot if `rank(parcel.size) ≤ rank(slot.size)`.

Layout is a CSS grid: `grid-template-columns: repeat(cols, 1fr)`, `grid-template-rows: repeat(12, var(--unit))`, each door spanning its `span` rows. `--unit` is computed in CSS from the available height (`clamp(24px, …, 40px)`); the wall never scrolls. On viewports narrower than 640 px the screen panel sits above the wall; otherwise it sits in the middle column of the wall as on a real locker. Tap targets for A doors are enlarged via transparent padding so the effective hit area is ≥ 40 px tall even when the visible door is 24 px.

### D4. Parcel identity

Parcel = `{ id, size, code, colour, sticker }`. Codes are 4 digits, unique within a day; the generator emits `lookalikePairs` count of pairs that differ by a digit transposition (e.g. 4821 / 4812). Colours: 6 named tokens (`red orange yellow green blue violet`); stickers: `none fragile arrow bang`. Both are rendered from CSS tokens, so themes restyle them. The hint line for a pickup customer is built from identity: PL „ten czerwony z naklejką” / EN "the red one with the sticker".

### D5. Day loop and timers (Daily profile for this change)

| Phase | Duration | Rule |
|---|---|---|
| LOAD | 25 s | Parcels arrive one at a time with the next two visible. `tapSlot` on a free, fitting slot places the current parcel. Timer expiry moves to SERVE; unplaced parcels are removed from the day with a penalty each. |
| SERVE | 65 s (displayed as 08:00→20:00) | Customers arrive from the schedule. Up to 3 are visible; the rest are pending and do not drain patience. Tapping a visible customer makes them active (default: front). Pickup: `tapSlot` on their slot opens the door and frees it; other slots count as a wrong tap. Sender: `tapSlot` on a free slot with `size ≥ needed` places a grey outgoing parcel; otherwise wrong tap. Patience 20 s per visible customer; at 0 they walk (pickup parcel stays, marked expired; sender counts as refused). |
| SWEEP | untimed (counted in total time) | Doors holding outgoing or expired parcels are marked; `tapSlot` on each clears it. When none remain → summary. |

Hint ladder (pickups only): level 1 after the first wrong tap **or** 6 s without a tap — the screen shows the colour swatch and sticker; level 2 after the second wrong tap **or** 12 s — the column containing the parcel is highlighted. The level is stored per customer and only ever rises; the idle timer restarts on a tap or when the active customer changes, so switching customers cannot be used to farm a free hint. A customer served at level 0 on the first tap yields outcome `perfect`; otherwise `hinted`; walked yields `walked`.

Schedule for the Daily profile: 16 pickup parcels loaded in LOAD; during SERVE 16 pickups + 4 senders arrive at seeded times spread over the first 45 s with slight jitter; 2 look-alike pairs. Invariant for every profile: `arrivalWindow + patience ≤ serve`, so a customer can never walk purely because SERVE ended before their patience did. These numbers live in `core/profiles.ts` as a `DayProfile` so the Week change adds rows, not code paths.

### D6. Scoring

- Served customer: `100 × m`, `m = 1 + clamp((20 − secondsWaiting) / 20, 0, 1)` → 100–200.
- Wrong tap: −25 (floor at 0 for the day).
- Sender refused (walked): −100. Pickup walked: −50. Parcel unplaced at LOAD: −50.
- Day score = sum; total time = LOAD elapsed + SERVE elapsed + SWEEP elapsed.

Reputation is intentionally absent; the Week change adds it on top of the same stats.

### D7. Daily mode rules and storage

`daily` → a map keyed by `YYYY-MM-DD` of `{ result?: { score, timeMs, grid }, practices: number }` (one storage key, so a day's records are read and written together). The first completed run on a date is the result; later runs are practice and the result screen labels them so. Streak = count of consecutive UTC dates, ending today or yesterday, that have a result. `best` stores the highest Daily score. Daily number `#N` = days since a launch epoch constant (`2026-09-01` = #1; adjust before launch).

### D8. Share card

One emoji per slot in wall order, one line per column (7 per line), top to bottom: 📦 perfect, 🟧 hinted, 🟥 walked/expired, ⬜ slot never held a pickup. Text:

```
paczkom.at · Dzisiaj #12
📦📦🟧📦📦📦📦
📦🟥📦📦📦⬜⬜
📦📦📦📦⬜⬜⬜
1240 pkt · 1:47
https://paczkom.at
```

Fallback chain: `navigator.share` (if `canShare`) → `navigator.clipboard.writeText` → a selectable `<textarea>` with the text. Labels are localised; the grid is not.

### D9. i18n

`i18n/pl.ts` and `i18n/en.ts` export flat `Record<Key, string>` catalogues; a `t(key, params?)` helper does `{param}` interpolation. Language is chosen once at boot: stored preference → `navigator.language` starts with `pl` → `pl`, else `en`. Switching re-renders the current screen without resetting game state. All user-visible strings, including hint lines and share labels, go through `t`.

### D10. Theming

All colour, radius, font, shadow, and motion durations are CSS custom properties defined in `theme/tokens.css` under `:root` and overridden per `[data-theme]`. The `signage` theme: background `#f2efe8`, ink `#111`, accent `#ff4f1f`, door `#f2efe8` on black wall, font a bundled open-licence grotesk (Inter, `latin` + `latin-ext` subsets for Polish diacritics, self-hosted woff2). Door state is expressed only as `data-state` (`empty | full | open | outgoing | expired | marked`) and `data-hint` (`column`); the theme maps those to visuals. A `<div class="scenery">` precedes the wall and is empty in `signage`; it exists so later themes can fill it. `@media (prefers-reduced-motion: reduce)` sets `--motion: 0ms`, which collapses door animations to instant state changes.

### D11. Audio

`audio/sfx.ts` lazily creates an `AudioContext` on the first pointer event (iOS unlock) and synthesises four cues with oscillators/noise: `tap` (short click), `door` (low thunk), `wrong` (buzz), `done` (two-note chime). Mute is a persisted boolean; when muted no context is created.

### D12. Persistence

`storage.ts` wraps `localStorage` with a `pk:v1:` key prefix and JSON values. Every access is in `try/catch`; on failure it switches to an in-memory map for the session, so private-mode browsers still get a working game without streaks.

### D13. Build, CI, deploy

- Vite with `base: '/'`; `public/CNAME` containing `paczkom.at`; `public/manifest.webmanifest` and icons; `index.html` is the only page (no routing).
- `npm` with a committed lockfile (no extra tooling to install).
- CI on push/PR: `tsc --noEmit`, `eslint`, `vitest run`, `vite build`, then Playwright (Chromium only) running one smoke test against the built `dist/`.
- Deploy: on push to `main`, after CI passes, `actions/upload-pages-artifact` + `actions/deploy-pages`. GitHub Pages source set to "GitHub Actions". Custom domain set in repo settings; DNS (apex A/AAAA to GitHub Pages, `www` CNAME) is configured by the owner.

### D14. Testing strategy

- Unit (Vitest): wall layout per column count; fit rules; parcel generator determinism and uniqueness; schedule determinism; reducer transitions for every phase and every wrong-tap case; hint ladder timing; scoring; share grid; storage fallback; i18n catalogue key parity (PL and EN must have identical key sets).
- Scripted days: fixtures of `{ seed, actions[] }` with an expected summary snapshot; these are the regression net for the whole loop.
- Smoke (Playwright): open title → start Daily → place one parcel → finish a day by idling → result screen visible with a share button.

## Risks / Trade-offs

- [Memory mechanic frustrates casual players] → hint ladder is time-based as well as mistake-based; practice replays are free; profile numbers are data and tunable without code changes.
- [A doors are ~24–28 px tall on small phones] → hit areas padded to ≥ 40 px; column count capped at 3 in this change; larger walls are validated in the Week change.
- [iOS Safari blocks audio until a gesture] → context created on first pointer event; game is fully playable muted.
- [UTC-based daily differs from local midnight] → accepted; the result screen shows the Daily number and date so confusion is visible, not silent.
- [`localStorage` cleared or unavailable loses streaks] → accepted for v1; no server means no recovery path.
- [Emoji render differently per platform] → accepted; only four emoji are used and all are in Unicode 6 era sets.
- [Playwright in CI is slow/flaky] → single Chromium test against the static build; unit and scripted-day tests carry the coverage.
- [Token discipline erodes and themes become expensive] → a test greps `src/ui` and `src/core` for hex colours and fails on any match.

## Migration Plan

1. Land the Node project and delete the Python scaffold in the first task group; nothing depends on the scaffold.
2. Enable GitHub Pages (source: GitHub Actions) and set the custom domain in repository settings; point DNS at GitHub Pages. Until DNS propagates the site is reachable at the `github.io` URL.
3. Rollback = revert the offending commit on `main`; the deploy workflow republishes the previous build.

## Open Questions

- Launch epoch for the Daily number (`#1`) — set to the actual launch date before the first deploy.
- Whether the title screen shows both languages' names ("Dzisiaj / Today") before a language is chosen, or relies on auto-detect only. Default: auto-detect only, with a visible PL/EN toggle.

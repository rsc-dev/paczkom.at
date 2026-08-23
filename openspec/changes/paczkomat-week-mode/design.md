## Context

`paczkomat-core-daily` delivers a pure reducer (`core/game.ts`) with LOAD → SERVE → SWEEP → SUMMARY, a `DayProfile` data type, a seeded schedule of customer arrivals, scoring, Daily mode, share card, i18n, the signage theme, and GitHub Pages deployment. This change adds the escalating Week run, mid-day events, and reputation, designed in the same brainstorming session (2026-08-23) as the core. It assumes the core's extension points: profiles are data, the schedule is a sorted list of timed entries, and the reducer is the only place game rules live.

## Goals / Non-Goals

**Goals:**

- A 10–12 minute Week run with a visible difficulty arc and a real fail state.
- Events implemented as schedule entries and reducer cases, reusing the existing phase machine.
- Daily raised to its intended difficulty.
- Shareable, replayable weeks via a URL seed.

**Non-Goals:**

- Leaderboards or any server; themes; new input models; Sunday as a playable day; save-and-resume mid-week (a week is one sitting; closing the tab loses the run).

## Decisions

### D1. Week as a thin run state around days

`core/week.ts` holds `{ seed, dayIndex (0–5), stars, dayResults[], status: 'playing' | 'failed' | 'done' }`. Each day is a fresh `initialState(daySeed, profiles[dayIndex])` where `daySeed = hash(seed, dayIndex)`. The day reducer is unchanged in shape; the week layer reads each day's SUMMARY to update stars and totals. *Why:* keeps `reduce` free of cross-day concerns and lets scripted-day fixtures remain valid. *Alternative:* one mega-state spanning the week — rejected; it couples the Daily code path to week bookkeeping.

### D2. Per-day profiles

| Day | Cols | Pickups | Senders | Pairs | Events | LOAD | SERVE | Patience |
|---|---|---|---|---|---|---|---|---|
| Mon | 2 | 8 | 0 | 0 | — | 25 s | 60 s | 24 s |
| Tue | 2 | 9 | 2 | 0 | — | 25 s | 60 s | 24 s |
| Wed | 3 | 12 | 3 | 1 | — | 25 s | 65 s | 22 s |
| Thu | 3 | 15 | 4 | 2 | jam ×1 | 25 s | 65 s | 20 s |
| Fri | 4 | 20 | 6 | 2 | forgotten ×2, late van | 25 s (×0.6) | 70 s | 20 s |
| Sat | 5 | 27 | 8 | 3 | jam ×1, forgotten ×2, rain, late van | 25 s (×0.6) | 75 s | 18 s |

Daily = the Thursday row. Numbers are data in `core/profiles.ts`; tuning is a data edit. Every profile keeps the invariant `arrivalWindow + patience ≤ serve` (e.g. Saturday: 75 − 18 = 57 s arrival window) so no customer walks solely because SERVE ended.

### D3. Events as schedule entries and reducer cases

The schedule is a discriminated union of entries (`{ kind: 'arrival', … } | { kind: 'jam', at, slot }`; `CustomerKind` stays separate) and gains per-customer flags `forgotten: true`; day-wide modifiers `rain: true` and `lateVan: true` live on the profile. Reducer behaviour:

- **Jammed door** (`slot.jammed = true`, independent of state): at `at` seconds into SERVE a seeded slot (preferring a `full` slot) jams; the door shows a jam marker. Senders cannot use it (tapping it is a wrong tap). For a pickup in a jammed slot the *first* correct tap un-jams (cue `thunk`, no penalty, no outcome change), the *second* opens the door. Jam clears on open or at SWEEP.
- **Forgotten code**: the customer card shows no code, only the description line (size + colour + sticker). Hint ladder behaves as usual from level 0, so a first-tap success is still `perfect`.
- **Rain**: day-wide; on the screen panel every displayed code has one seeded digit position masked (`48•1`). Descriptions are unaffected. Implemented in the view from a `maskedDigit` index in state so it is deterministic and testable.
- **Late van**: LOAD duration is multiplied by 0.6 for that day; the HUD shows a "van late" note during LOAD.

*Why this shape:* every event is either data on the profile, an entry on the already-sorted schedule, or a flag on an existing entity; no new phase or subsystem. *Alternative considered:* an event bus with handlers — more general than needed and harder to keep deterministic.

### D4. Reputation

`stars` starts at 3. After each day's SUMMARY the week layer subtracts one star per `unplaced` parcel, per `refused` sender, and per `walked` pickup, floored at 0. Stars never regenerate. If stars reach 0 the run ends immediately on the Reklamacja screen (the day's summary is still shown inside it). *Why one-per-incident:* Monday–Wednesday are forgiving at these volumes; Friday–Saturday are genuinely dangerous, which is the arc. Daily mode ignores stars.

### D5. Seed in URL

`/?week=<base36 seed>` starts Week with that seed; the title's Week button uses a random seed and rewrites the URL with `history.replaceState` so the address bar is shareable mid-run. The week-summary and Reklamacja screens offer "Copy link" (same share chain as the Daily card) and "Retry this week" / "New week".

### D6. Week share text

```
paczkom.at · Tydzień
Pn ⭐⭐⭐ 1 240
Wt ⭐⭐⭐ 1 380
Śr ⭐⭐  1 610
Cz ⭐⭐  1 720
Pt ⭐   1 950
So ❌
https://paczkom.at/?week=k3j9x
```

A failed week lists days up to the failure with ❌ on the failing day. Day abbreviations are localised.

### D7. Screens

- **Day summary** (between days): score, stars (with the ones just lost animated out), outcome counts, "Next day" button.
- **Week summary** ("Niedziela"): per-day table, total score, stars remaining, best-week comparison, share, retry, new week.
- **Reklamacja**: day reached, total score, the incident list that cost the last star, share, retry same seed, new week.

### D8. Larger walls on phones

Four- and five-column walls reuse the existing CSS grid; `--unit` will hit its 24 px floor on short phones, so A doors are 24 px tall with 40 px hit areas. The smoke test gains a 5-column layout assertion at 360×640. If real-device testing shows misses on A doors, the fallback is to lower Saturday to 4 columns with 30 pickups — a profile edit.

## Risks / Trade-offs

- [Saturday is too hard / Monday too dull] → all knobs are profile data; tune after play-testing, no code changes.
- [Jam on a slot whose customer is already visible confuses the player] → jam times are scheduled before the affected customer's arrival when a `full` slot is chosen; the un-jam tap gives explicit feedback.
- [Rain mask makes look-alike pairs unfair] → the masked digit is never one of the transposed positions of a pair.
- [Week lost on tab close] → accepted; a week is ~12 minutes. Revisit if users ask.
- [URL seed manipulation] → harmless; there is no server or leaderboard.

## Migration Plan

Ships as a normal deploy after `paczkomat-core-daily`. The Daily profile change alters the puzzle for the day it lands; the Daily number sequence is unaffected. No stored-data migration: new keys only (`week:best`).

## Open Questions

- Whether un-jam should cost time (a 2 s delay) instead of a second tap. Default: second tap; revisit in play-testing.
- Whether to show the week's per-day emoji grids on the week summary (long) or only stars and scores (chosen default).

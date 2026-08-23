## Why

`paczkomat-core-daily` ships one two-minute day. After it, a first-time visitor has a single experience and nothing to return to between dailies. This change adds the escalating **Week** run ("Tydzień"), the mid-day events that make later days hard, and the reputation fail state — the content and stakes that turn the engine into a game with an arc. It also raises Daily to its intended difficulty once the events exist.

**Depends on:** `paczkomat-core-daily` (implemented and archived). The reducer, profiles and schedule it delivers are extended here, not rewritten.

## What Changes

- Add **Week mode**: six escalating days Monday–Saturday in one sitting, a day-summary screen between days, a week-summary screen on "Sunday", and a seed carried in the URL so a week can be shared and replayed ("beat my week").
- Add **day events** scheduled into SERVE/LOAD: jammed door, forgotten code, rain (masked code digits), late van (short LOAD). Look-alike codes already exist and become a per-day knob.
- Add **reputation**: three stars that are lost on unplaced parcels, refused senders and walked customers; zero stars ends the run on a "Reklamacja" screen.
- Add per-day profiles for Monday–Saturday (columns 2→5, parcels 8→35) and validate 4- and 5-column walls on phones.
- Modify **Daily** to the Thursday-grade profile (adds a jammed door) now that the event exists.
- Extend the share card with a Week format (one line per day with stars and score, plus the seeded URL).
- Extend the title screen with the Week button and best-week record; add day-summary, week-summary and reklamacja screens; extend how-to with events and stars.

## Capabilities

### New Capabilities
- `week-mode`: run structure Monday–Saturday, per-day profiles, day/week summaries, seed from URL, best-week persistence, retry and new-week flows.
- `day-events`: jammed door, forgotten code, rain, late van — scheduling, reducer behaviour and UI presentation.
- `reputation`: star meter, loss rules, fail state and the Reklamacja screen.

### Modified Capabilities
- `daily-mode`: Daily profile becomes Thursday-grade (15 pickups, 4 senders, 2 look-alike pairs, one jammed door).
- `locker-wall`: whole-wall-visible requirement extended to 4 and 5 columns on phone viewports.
- `share-card`: Week share text format added alongside the Daily format.
- `site-shell`: title screen gains Week entry and best week; new day-summary, week-summary and reklamacja screens; how-to gains events and stars.

## Impact

- **Code**: `core/profiles.ts` (six day profiles), `core/schedule.ts` (event entries), `core/game.ts` (event actions and jammed/forgotten/rain/late-van behaviour, reputation accounting), `core/week.ts` (run state around days), `core/share.ts` (week text), `ui/` screens and screen-panel rendering for masked codes and descriptions, `i18n` catalogues, `storage.ts` keys (`week:best`).
- **Tests**: new scripted-week fixtures; event-specific reducer tests; 4/5-column layout checks in the smoke test.
- **No new dependencies, no backend, no infra changes.**

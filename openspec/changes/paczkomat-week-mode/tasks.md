## 1. Profiles and schedule

- [x] 1.1 Extend `DayProfile` with `jams`, `forgotten`, `rain`, `lateVan`, `patienceS`; add the six Monday–Saturday profiles and switch `daily` to the Thursday profile
- [x] 1.2 `core/schedule.ts`: emit jam entries (seeded slot preferring `full`, scheduled before that slot's customer), flag seeded pickups as `forgotten`, derive the rain mask index avoiding look-alike transposition positions; determinism tests
- [x] 1.3 `core/parcel.ts`: honour per-profile look-alike pair counts including 0 and 3; tests

## 2. Reducer: events

- [x] 2.1 Jammed door: `slot.jammed` flag, scheduled jam action, sender rejection, two-tap pickup (un-jam then open), clear on open/SWEEP, jam marker in `data-jammed`; tests
- [x] 2.2 Forgotten code: customer flag, screen model without code, hint ladder unchanged; tests
- [x] 2.3 Rain: `maskedDigit` in state, masked code in the screen model; tests for mask and pair avoidance
- [x] 2.4 Late van: LOAD duration ×0.6, HUD note flag; test
- [x] 2.5 Scripted-day fixtures for Thursday (jam) and Saturday (all events)

## 3. Week run and reputation

- [x] 3.1 `core/week.ts`: run state, day seed derivation `hash(seed, dayIndex)`, advance, star accounting (one per unplaced/refused/walked, floor 0), fail detection, totals; tests for star loss, floor, fail, determinism
- [x] 3.2 Seed encoding (base36) and `?week=` parsing/writing with `history.replaceState`
- [x] 3.3 `storage.ts`: `week:best` key; best-week update rule; tests
- [x] 3.4 Scripted-week fixture: a full six-day action log with expected totals, and a failing-on-Friday log

## 4. UI

- [x] 4.1 Screen panel: jam marker on doors, forgotten-code description-only layout, masked code rendering, late-van HUD note, star display in HUD during Week
- [x] 4.2 Title screen: Week button, best-week record; how-to: events and stars steps (PL/EN)
- [x] 4.3 Day-summary screen with star-loss animation and "Next day"
- [x] 4.4 Week-summary screen: per-day table, totals, best comparison, share, retry, new week
- [x] 4.5 Reklamacja screen: day reached, total, final-day incidents, share, retry, new week
- [x] 4.6 `core/share.ts`: Week share text (completed and failed variants); share button wiring on week screens; tests
- [x] 4.7 i18n: all new strings in PL and EN; key-parity test green
- [x] 4.8 Layout pass for 4- and 5-column walls at 360×640, 390×844, 1280×800; adjust `--unit` floor or hit-area padding if needed

## 5. Quality gates and docs

- [x] 5.1 Smoke test: start Week from title, verify `?week=` in URL, Monday LOAD renders; 5-column layout assertion at 360×640
- [x] 5.2 ESLint, typecheck, unit tests, build green
- [x] 5.3 README: Week mode, seeded links, tuning profiles in `core/profiles.ts`

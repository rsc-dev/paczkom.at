## 1. Core: what a saved run may be

- [x] 1.1 `core/week.ts`: `parseWeekState(value: unknown): WeekState | null` accepting only a playing run the rules could have produced (design D5: seed uint32, status `playing`, dayIndex in range, stars in `[1, STARTING_STARS]`, `days` of exactly `dayIndex` well-formed entries in order with non-increasing stars ending on the week's stars); tests for a round-trip of a real `WeekState`, and for each rejected shape (wrong status, six stars, day index nine, days out of order, a day with more stars than the day before, non-object, string, null)

## 2. Run: write, clear, read

- [x] 2.1 `storage.ts`: `STORAGE_KEYS.weekRun = 'week:run'`
- [x] 2.2 `run.ts`: `readSavedWeek(storage): WeekState | null` (parses; removes the key when the value does not validate), `startWeekRun(env, seed)` writes the fresh Monday state, `finishWeekDay` writes the advanced state while `playing` and removes the key on `done` or `failed`; update every caller of `startWeekRun` (D2)
- [x] 2.3 `run.test.ts`: saved after Monday with the right day, stars and one filed day; cleared on Saturday done; cleared on a fail; replaced by a new seed; a corrupt value reads as `null` and is gone afterwards; storage that refuses writes still returns a playable run

## 3. UI: the title knows, the screens reuse

- [x] 3.1 `index.html`: `#btn-continue-week` above the Week button, hidden by default; `i18n`: `title.continueWeek` in PL (`Dokończ tydzień · {day}`) and EN (`Continue week · {day}`); key-parity test green
- [x] 3.2 `ui/screens.ts`: `TitleModel.savedDay: number | null`, `TitleNodes.continueWeek`; `renderTitle` sets the button's text to the full day name and toggles `hidden` (D6); `screens.test.ts` covers shown-with-name and hidden
- [x] 3.3 `main.ts`: `resumeWeek(week)` per D4 — sets `run` via `continueWeekRun`, rebuilds `lastWeekOutcome` with `isBest: false`, shows the day-summary of the last filed day or plays Monday when nothing is filed; wire `#btn-continue-week`; `renderChrome` passes `savedDay` from `readSavedWeek`
- [x] 3.4 `main.ts` boot routing per D3: a URL seed equal to the saved run's seed resumes, any other seed starts fresh, no seed shows the title

## 4. Proof and docs

- [x] 4.1 `e2e/week.spec.ts`: play Monday well, reload the same `?week=` URL, expect the day-summary with Monday's stars and "Next day" into Tuesday with 14 doors; open `/` instead and expect the continue button naming Tuesday, click it, same day-summary; idle Monday into the Reklamacja screen, open `/`, expect no continue button
- [x] 4.2 `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`, `npm run test:e2e` all green
- [x] 4.3 README: the Week paragraph says a run is saved between days and a reload or the title's continue action picks it up; the "before the first deploy" list is unchanged

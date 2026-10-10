## Why

A Week is ten to twelve minutes in one sitting and the only thing persisted is the best *completed* total: a closed tab, a phone that kills the page, or a back-swipe on Saturday loses the whole run. The week-mode design accepted this as a non-goal so the mode could ship; the batch report lists it as the first open concern, and now that the difficulty arc is being tuned the cost of a lost Saturday is the loudest complaint a playtester can make.

**Depends on:** `paczkomat-week-mode` (implemented and archived). The `WeekState` it delivers is what gets saved; the day reducer is not touched.

## What Changes

- **Save the Week run in progress at day boundaries.** The `WeekState` — seed, day about to be played, stars, the days filed so far — is written when a week starts and after each day is filed while the run is still playing. Never mid-day: the pure reducer and its timers stay exactly as they are.
- **A finished or failed week removes the saved run.** Starting a new week or retrying replaces it.
- **The title screen offers "Continue week · Thursday"** when a saved run exists, naming the day about to be played. Continuing lands on the day summary of the last day played, so the player re-reads their stars and total before "Next day"; a saved run with no day finished starts Monday directly.
- **Reloading the page mid-week resumes.** `?week=<seed>` stays in the address bar during a run, so a reload carries the seed; when it matches the saved run, the run resumes instead of restarting Monday. A different seed is a new week and replaces the saved one.
- **A saved run that does not validate is ignored** and removed, so a hand-edited or stale value can never put the game in a state the rules did not produce.
- Reverses the week-mode design's non-goal "a week is one sitting; closing the tab loses the run".

## Capabilities

### New Capabilities

None. Resuming is a facet of the Week mode, not a mode of its own.

### Modified Capabilities

- `week-mode`: new requirements for saving the run at day boundaries and resuming it from the title; the "Seed in URL" requirement gains the rule that a seed matching the saved run resumes rather than restarts.
- `persistence`: the list of stored data gains the best week and the week in progress.
- `site-shell`: the title screen gains a continue-week action shown only while a saved run exists.

## Impact

- **Code**: `core/week.ts` (validation of a stored `WeekState`), `storage.ts` (key `week:run`), `run.ts` (write on start and after each day, remove on done/failed, read for the title), `main.ts` (boot routing between URL seed and saved run; the resume flow; the title button), `ui/screens.ts` (title model gains the saved day), `index.html` and both i18n catalogues (one button, one string).
- **Tests**: validator unit tests; run tests for save, clear and replace; title-screen render test; three end-to-end cases — reload resumes onto the day summary, the title's continue button, a finished week leaves nothing saved.
- **Docs**: README's Week paragraph; the archived design's non-goal is superseded by this change's design.
- **No new dependencies, no backend, no infra changes.** The storage namespace does not change; older builds simply never read the new key.

## Context

`paczkomat-week-mode` delivers `core/week.ts`: a `WeekState` of `{ seed, dayIndex, stars, days[], status }` that a thin bookkeeper in `run.ts` advances by reading each day's SUMMARY. The day reducer knows nothing about weeks. Persistence is a namespaced, best-effort `localStorage` wrapper with an in-memory fallback; today it holds only the best completed week total (`week:best`). `main.ts` keeps `?week=<seed>` in the address bar for the whole run.

Its design listed "save-and-resume mid-week" as a non-goal. This change supersedes that.

## Goals / Non-Goals

**Goals:**

- A closed tab, a killed page or a reload costs the current *day* at most, never the week.
- Zero changes to the reducer, the fixtures or the day timers.
- A resumed run is indistinguishable from an uninterrupted one: same seeds, same profiles, same stars.

**Non-Goals:**

- Resuming mid-day (see D1). Pausing. Multiple saved weeks. Any protection against a player editing their own `localStorage` — there is no leaderboard to protect.
- A conflict dialog when a shared link arrives while another week is saved (see Risks).

## Decisions

### D1. Day granularity: the `WeekState` is the save file

What is saved is the `WeekState` verbatim, under `pk:v1:week:run`, and only while `status === 'playing'`. `dayIndex` is already "the day about to be played" and `days[]` already carries every filed day with its grid, so nothing new is computed to save or to resume.

*Why not the day in progress:* a day is two minutes and a week is twelve; day granularity recovers nearly all of the value. Saving mid-day would mean either snapshotting the whole reducer state per frame or persisting the action log (the core is replayable from `seed + log`), and either way a resumed day would pick up patience timers mid-drain after an arbitrary break — a fairness problem the rules do not currently have. Rejected.

### D2. Two write points, both in `run.ts`

- `startWeekRun(env, seed)` writes the fresh Monday state. A reload during Monday then resumes as "Monday, nothing filed yet", which is the same as retrying — but it keeps the seed, and it makes "a saved run exists" true from the first second, so the title never lies.
- `finishWeekDay(env, …)` writes the advanced state when the week is still `playing`, and removes the key when it is `done` or `failed`.

Retry and new week both go through `startWeekRun`, so "replace" needs no code of its own. There is no way to abandon a week from inside the UI except closing it, which is the whole point. `run.ts` already owns the only other week write (`week:best`), so the storage discipline stays in one file.

### D3. Boot routing: the URL seed wins, and a matching seed resumes

At boot, in this order:

1. `?week=<seed>` present. If a valid saved run has the same seed → resume it (D4). Otherwise → start that week fresh, which replaces whatever was saved.
2. No seed in the URL → title screen. If a valid saved run exists, the title shows the continue action.

*Why the URL wins:* a link is an explicit act, and the address bar during a run always carries the running seed, so the common case — reload — hits the resume branch. The rare case — a friend's link arriving mid-week — replaces the saved run silently. See Risks.

### D4. Where resume lands

`resumeWeek(week)` sets `run = continueWeekRun(week)` and `lastWeekOutcome = { week, day: days.at(-1), total, best: readWeekBest, isBest: false }`, then:

- if a day has been filed → the **day-summary screen** for the last day, with its normal "Next day" button. The player re-reads stars and total before the next LOAD, and a language switch re-renders it exactly as it did the first time.
- if no day has been filed → straight into Monday's LOAD via the ordinary `playRun`.

*Why not always straight into LOAD:* after a break the player needs to know how many stars they have left before a late-van Friday starts counting down. The day screen already says exactly that, and reusing it costs nothing.

### D5. Validation lives in the core

`parseWeekState(value: unknown): WeekState | null` in `core/week.ts` accepts only a value the rules could have produced: `seed` an unsigned 32-bit integer; `status === 'playing'`; `dayIndex` an integer in `[0, WEEK_LENGTH)`; `stars` an integer in `[1, STARTING_STARS]`; `days` an array of exactly `dayIndex` entries whose `dayIndex` fields are `0..n-1` in order, with finite non-negative `score`, `timeMs`, `starsLost` and incident counts, integer `stars` in `[1, STARTING_STARS]` that never increase from one day to the next, drop each day by exactly that day's `starsLost`, and end on the week's `stars`, and a `grid` of strings. Anything else is `null`; the caller removes the key.

*Why in the core:* it is a pure function over data the core defines, and it is where the invariants (`WEEK_LENGTH`, `STARTING_STARS`) already live. The storage layer stays ignorant of what it stores.

### D6. Title model gains one field

`TitleModel.savedDay: number | null` — the index of the day about to be played, or `null`. `renderTitle` shows `#btn-continue-week` with `title.continueWeek` (`Dokończ tydzień · Środa` / `Continue week · Wednesday`) when it is not `null` and hides it otherwise. It sits above the Week button as the primary action, because when it exists it is the most likely thing the player came back for. The Week button keeps its meaning — a new week — as the proposal's "starting a new week replaces" rule says.

## Risks / Trade-offs

- **A shared link replaces a week in progress (D3).** → Documented rule; the address bar during a run always carries the running seed so a plain reload is safe. If playtests show people losing runs to links, the fix is a title-screen conflict state with both options, and nothing in this design blocks adding it.
- **Profiles can change under a saved run** (today's load-budget tuning is an example). → Profiles are read at resume time and past days keep their filed scores; the day seed is a function of the week seed and index only, so the wall is still the wall. Accepted: a week saved across a deploy is played by the current rules from where it stands.
- **Storage refused (private mode).** → The in-memory fallback keeps resume working within a session; after a reload there is nothing saved and the title shows no continue action, which is what the existing "will not remember your streak" note already warns about. No new failure mode.
- **Hand-edited storage.** → `parseWeekState` keeps the game inside its own rules; it is not, and does not need to be, tamper-proof.

## Migration Plan

New key only. Deploy is the ordinary push to `main`; a rollback leaves an orphan `pk:v1:week:run` that the older build never reads. Nothing to migrate.

## Open Questions

None blocking. Whether the continue action should also show stars left ("· ⭐⭐") is a copy decision to make once it is on a real phone.

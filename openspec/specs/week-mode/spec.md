# week-mode Specification

## Purpose
The Week game mode: a six-day seeded run Monday–Saturday with escalating day profiles, seed-in-URL sharing, week results, and retry / new-week flows.

## Requirements

### Requirement: Run structure
A Week run SHALL consist of six days Monday–Saturday played in sequence in one session, each day using its own profile and a day seed derived from the week seed and day index. A day-summary screen SHALL appear between days and a week-summary screen after Saturday.

#### Scenario: Day seeds differ but are deterministic
- **WHEN** a week is started twice with seed 42
- **THEN** both runs produce identical day seeds, and the six day seeds within a run are pairwise distinct

#### Scenario: Advance
- **WHEN** Monday reaches SUMMARY and the user continues
- **THEN** Tuesday starts in LOAD with the Tuesday profile

### Requirement: Day profiles
The six profiles SHALL be: Mon 2 columns / 8 pickups / 0 senders / 0 pairs; Tue 2 / 9 / 2 / 0; Wed 3 / 12 / 3 / 1; Thu 3 / 15 / 4 / 2 with one jam; Fri 4 / 20 / 6 / 2 with two forgotten codes and late van; Sat 5 / 27 / 8 / 3 with one jam, two forgotten codes, rain and late van. Patience SHALL be 24, 24, 22, 20, 20, 18 s respectively.

#### Scenario: Saturday profile
- **WHEN** Saturday starts
- **THEN** the wall has 35 slots, the load queue has 27 parcels, and the schedule contains 8 senders, one jam, two forgotten-code customers, rain and late-van flags

### Requirement: Seed in URL
Starting Week from the title SHALL choose a random seed and write `?week=<seed>` to the URL without navigation; loading a URL with `?week=<seed>` SHALL start that week directly. If a saved run exists with the same seed, loading that URL SHALL resume the saved run instead of starting Monday; a different seed SHALL start that week fresh and replace the saved run.

#### Scenario: Shared link
- **WHEN** the page loads with `?week=k3j9x` and nothing is saved
- **THEN** a Week run starts with seed `k3j9x`

#### Scenario: Reload mid-week
- **WHEN** Monday of seed `k3j9x` has been filed and the page reloads with `?week=k3j9x` still in the URL
- **THEN** the day-summary screen shows Monday's result and "Next day" starts Tuesday

#### Scenario: A different link replaces the saved run
- **WHEN** a run of seed `k3j9x` is saved at Thursday and the page loads with `?week=abc12`
- **THEN** a Week run starts on Monday with seed `abc12` and the saved run is now that one

### Requirement: Week results
The week summary SHALL show per-day scores and stars, total score, stars remaining and the best-week score; a completed week with a higher total SHALL update the persisted best.

#### Scenario: New best
- **WHEN** a week finishes with a total above the stored best
- **THEN** the stored best is replaced and the summary marks it as a new best

### Requirement: Retry and new week
Week-summary and Reklamacja screens SHALL offer "Retry this week" (same seed) and "New week" (new random seed).

#### Scenario: Retry
- **WHEN** the user chooses retry after failing on Friday
- **THEN** a new run starts on Monday with the same week seed

### Requirement: Week in progress is saved
A Week run SHALL be persisted at day boundaries: when the week starts, and after each day is filed while the run is still playing. What is saved SHALL be the run state — seed, the day about to be played, stars, and every day filed so far. A run that finishes or fails SHALL remove the saved run. Starting a new week or retrying SHALL replace the saved run with the fresh one. A saved run that does not validate against the rules SHALL be treated as absent and removed.

#### Scenario: Saved after a day
- **WHEN** Monday of seed 42 is filed with three stars left
- **THEN** the saved run has seed 42, Tuesday as the day about to be played, three stars and one day filed

#### Scenario: Cleared on completion
- **WHEN** Saturday is filed and the week is done
- **THEN** no saved run remains

#### Scenario: Cleared on failure
- **WHEN** a day is filed and the stars reach zero
- **THEN** no saved run remains

#### Scenario: Replaced by a new week
- **WHEN** a run of seed 42 is saved at Thursday and the user starts a week with seed 7
- **THEN** the saved run is seed 7 at Monday with nothing filed

#### Scenario: Corrupt saved run ignored
- **WHEN** the saved run claims six stars, or a day index of nine, or a status other than playing
- **THEN** it is treated as absent and the title screen offers no continue action

### Requirement: Resume a saved week
When a saved run exists and the page loads without a week seed in the URL, the title screen SHALL offer a continue action naming the day about to be played. Choosing it SHALL show the day-summary screen of the last day filed, from which "Next day" starts the next day with its own profile and day seed; a saved run with no day filed SHALL start Monday directly. A resumed run SHALL use the same day seeds, profiles and stars as the uninterrupted run would have.

#### Scenario: Continue from the title
- **WHEN** a run of seed 42 is saved at Wednesday with two stars and the user opens the site and chooses the continue action
- **THEN** the day-summary screen shows Tuesday's result with two stars, and "Next day" starts Wednesday in LOAD with the Wednesday profile and two stars in the HUD

#### Scenario: Continue with nothing filed
- **WHEN** a run is saved at Monday with no day filed and the user chooses the continue action
- **THEN** Monday starts in LOAD with the saved seed

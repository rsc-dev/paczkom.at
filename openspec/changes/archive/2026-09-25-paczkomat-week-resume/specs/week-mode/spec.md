## ADDED Requirements

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

## MODIFIED Requirements

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

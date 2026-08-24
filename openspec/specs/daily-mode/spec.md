# daily-mode Specification

## Purpose
The Daily game mode: a date-seeded identical day for all players, one official result per UTC date, practice runs, streaks, best score, and the result screen.

## Requirements

### Requirement: Date-derived seed
The Daily seed SHALL be the FNV-1a 32-bit hash of the current UTC date formatted `YYYY-MM-DD`, so every player on the same UTC date plays the identical day.

#### Scenario: Same date, same seed
- **WHEN** the seed is computed twice for 2026-09-14
- **THEN** both values are equal

### Requirement: Daily profile
Daily SHALL use the Thursday profile: 3 columns, 15 pickups, 4 senders, 2 look-alike pairs, one jammed door, LOAD 25 s, SERVE 65 s, patience 20 s.

#### Scenario: Profile applied
- **WHEN** a Daily day is started
- **THEN** the wall has 21 slots, the load queue has 15 parcels, and the schedule contains one jam entry

### Requirement: First attempt counts
The first completed Daily on a UTC date SHALL be stored as that date's result. Subsequent runs on the same date SHALL be practice: they replay the same seed, increment a practice counter, and SHALL NOT overwrite the result.

#### Scenario: Second run is practice
- **WHEN** a player finishes a Daily on a date that already has a result
- **THEN** the stored result is unchanged, `practices` increments and the result screen is labelled as practice

### Requirement: Streak and best
The streak SHALL be the number of consecutive UTC dates ending today or yesterday that have a stored result. Best SHALL be the highest stored Daily result score.

#### Scenario: Streak continues
- **WHEN** results exist for the three dates ending yesterday and the player completes today
- **THEN** the streak is 4

#### Scenario: Streak broken
- **WHEN** the last result is from three days ago and the player completes today
- **THEN** the streak is 1

### Requirement: Daily number
The Daily number SHALL be `days since launch epoch + 1`, with the epoch a constant in code.

#### Scenario: Epoch day
- **WHEN** the UTC date equals the epoch
- **THEN** the Daily number is 1

### Requirement: Result screen
After SUMMARY the result screen SHALL show the Daily number and date, score, total time, the emoji grid, streak, best, a share button, and a practice-again button; practice runs SHALL show both the practice score and the stored result.

#### Scenario: Result content
- **WHEN** a first Daily attempt completes
- **THEN** the screen shows all listed fields with the result marked as today's official result

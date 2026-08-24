## MODIFIED Requirements

### Requirement: Screens
The site SHALL provide a title screen (name, Daily button, Week button, how-to button, PL/EN toggle, mute toggle, streak, best week), a how-to screen explaining LOAD/SERVE/SWEEP, events and stars in short steps, the game screen, the Daily result screen, the day-summary screen, the week-summary screen and the Reklamacja screen. All screens SHALL be reachable without page navigation.

#### Scenario: Title to game
- **WHEN** the user taps the Daily button on the title screen
- **THEN** the game screen appears in LOAD phase

#### Scenario: Title to week
- **WHEN** the user taps the Week button on the title screen
- **THEN** the game screen appears in LOAD phase with the Monday profile and the URL contains `?week=`

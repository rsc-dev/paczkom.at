## MODIFIED Requirements

### Requirement: Screens
The site SHALL provide a title screen (name, Daily button, Week button, a continue-week action shown only while a Week run is saved, how-to button, PL/EN toggle, mute toggle, streak, best week), a how-to screen explaining LOAD/SERVE/SWEEP, events and stars in short steps, the game screen, the Daily result screen, the day-summary screen, the week-summary screen and the Reklamacja screen. All screens SHALL be reachable without page navigation.

#### Scenario: Title to game
- **WHEN** the user taps the Daily button on the title screen
- **THEN** the game screen appears in LOAD phase

#### Scenario: Title to week
- **WHEN** the user taps the Week button on the title screen
- **THEN** the game screen appears in LOAD phase with the Monday profile and the URL contains `?week=`

#### Scenario: Title with a saved week
- **WHEN** a Week run is saved at Thursday and the title screen renders
- **THEN** a continue action naming Thursday is visible, and it is hidden again once no run is saved

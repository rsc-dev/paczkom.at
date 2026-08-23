## ADDED Requirements

### Requirement: Catalogues
The UI SHALL have Polish and English string catalogues with identical key sets, and every user-visible string (including customer hint lines and share labels) SHALL be produced through the translation helper.

#### Scenario: Key parity
- **WHEN** the catalogues are compared
- **THEN** the set of keys in PL equals the set of keys in EN

#### Scenario: Interpolation
- **WHEN** `t("hint.colour", { colour: "czerwony" })` is called in PL
- **THEN** the result contains "czerwony"

### Requirement: Language selection
At boot the language SHALL be the stored preference if present; otherwise `pl` when `navigator.language` starts with `pl`, else `en`.

#### Scenario: Polish browser, no preference
- **WHEN** no preference is stored and `navigator.language` is `pl-PL`
- **THEN** the UI renders in Polish

#### Scenario: Stored preference wins
- **WHEN** the stored preference is `en` and `navigator.language` is `pl-PL`
- **THEN** the UI renders in English

### Requirement: Live toggle
A visible PL/EN toggle SHALL switch language, persist the choice, and re-render the current screen without resetting game state.

#### Scenario: Toggle mid-day
- **WHEN** the user toggles language during SERVE
- **THEN** the screen and HUD text change language and the day continues uninterrupted

### Requirement: Brand wording
In-game copy SHALL refer to the machine as "automat paczkowy" (PL) / "parcel locker" (EN) and SHALL NOT use third-party operator names, colours, or logos.

#### Scenario: No operator names
- **WHEN** both catalogues are scanned
- **THEN** no string contains a parcel-locker operator's brand name

# reputation Specification

## Purpose
The Week reputation system: the three-star meter, the Reklamacja fail state, and how stars are displayed.

## Requirements

### Requirement: Star meter
A Week run SHALL start with 3 stars. After each day one star SHALL be removed per unplaced parcel, per refused sender and per walked pickup, floored at 0. Stars SHALL never increase during a run. Daily mode SHALL NOT use stars.

#### Scenario: Two incidents
- **WHEN** a day ends with one refused sender and one walked pickup at 3 stars
- **THEN** the run has 1 star

#### Scenario: Floor
- **WHEN** a day ends with four incidents at 2 stars
- **THEN** the run has 0 stars

### Requirement: Fail state
When stars reach 0 the run SHALL end immediately on the Reklamacja screen, which SHALL show the day reached, total score, the incidents from the final day, and the retry / new-week / share actions.

#### Scenario: Failing on Friday
- **WHEN** Friday's summary drops stars to 0
- **THEN** the Reklamacja screen appears instead of the day summary, showing Friday as the day reached

### Requirement: Star display
The HUD SHALL show the current stars during Week days, and the day summary SHALL animate the loss of any stars lost that day.

#### Scenario: HUD stars
- **WHEN** a Week day is in SERVE with 2 stars
- **THEN** the HUD shows two filled and one empty star

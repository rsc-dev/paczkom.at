## ADDED Requirements

### Requirement: Week share text
The Week share text SHALL be: header `paczkom.at · {weekLabel}`, one line per played day with the localised day abbreviation, the stars remaining after that day as ⭐ characters (❌ for the failing day), and that day's score; then the URL `https://paczkom.at/?week=<seed>`.

#### Scenario: Completed week
- **WHEN** a week with seed `k3j9x` completes with all six days
- **THEN** the text has six day lines and ends with `https://paczkom.at/?week=k3j9x`

#### Scenario: Failed week
- **WHEN** a week fails on Friday
- **THEN** the text has five day lines, the fifth shows ❌, and no Saturday line is present

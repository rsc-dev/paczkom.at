# share-card Specification

## Purpose
The shareable result: per-slot emoji grid, share text format, and the share/clipboard/textarea fallback chain.

## Requirements

### Requirement: Emoji grid
The share grid SHALL contain one emoji per slot in wall order, one line per column listing slots top to bottom: 📦 for outcome `perfect`, 🟧 for `hinted`, 🟥 for `walked`, ⬜ for a slot that never held a pickup parcel.

#### Scenario: Grid shape
- **WHEN** the grid is built for a 3-column wall
- **THEN** it has 3 lines of 7 emoji each

#### Scenario: Outcome mapping
- **WHEN** slot `c1r0` has outcome `hinted`
- **THEN** the second line's first emoji is 🟧

### Requirement: Share text
The share text SHALL be, in order: the header line `paczkom.at · {modeLabel} #{n}`, the grid lines, a line with the score and formatted time `m:ss`, and the URL `https://paczkom.at`. The mode label SHALL be localised; emoji and URL SHALL NOT.

#### Scenario: Polish share text
- **WHEN** the language is PL, Daily #12, score 1240, time 107 000 ms
- **THEN** the header is `paczkom.at · Dzisiaj #12` and the stats line is `1240 pkt · 1:47`

### Requirement: Share fallback chain
Activating share SHALL try `navigator.share` when available and `canShare` accepts the payload; otherwise `navigator.clipboard.writeText`; otherwise show the text in a selectable text area. The UI SHALL confirm which path succeeded.

#### Scenario: Clipboard fallback
- **WHEN** `navigator.share` is undefined and the clipboard API is available
- **THEN** the text is written to the clipboard and a "copied" confirmation is shown

#### Scenario: No APIs
- **WHEN** neither share nor clipboard APIs are available
- **THEN** the share text is displayed in a selectable text area

### Requirement: Week share text
The Week share text SHALL be: header `paczkom.at · {weekLabel}`, one line per played day with the localised day abbreviation, the stars remaining after that day as ⭐ characters (❌ for the failing day), and that day's score; then a line with the localised total label, the sum of every played day's score and the localised points abbreviation; then the URL `https://paczkom.at/?week=<seed>`.

#### Scenario: Completed week
- **WHEN** a week with seed `k3j9x` completes with all six days
- **THEN** the text has six day lines, a total line, and ends with `https://paczkom.at/?week=k3j9x`

#### Scenario: Failed week
- **WHEN** a week fails on Friday
- **THEN** the text has five day lines, the fifth shows ❌, and no Saturday line is present

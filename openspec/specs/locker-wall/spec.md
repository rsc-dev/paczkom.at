# locker-wall Specification

## Purpose
The locker wall: column layout and slot sizes, the parcel-to-slot fit rule, door states, always-visible responsive rendering, and enlarged hit areas.

## Requirements

### Requirement: Column layout
The wall SHALL consist of N columns, each 12 units tall and laid out top to bottom as A, A, A, A, B, B, C, where slot sizes A, B, C span 1, 2 and 4 units respectively. Slot ids SHALL be `c{col}r{index}` with zero-based column and per-column index.

#### Scenario: Three-column wall
- **WHEN** a wall is generated with 3 columns
- **THEN** it contains 21 slots: 12 of size A, 6 of size B, 3 of size C, each with the correct column, row offset and span

#### Scenario: Column count is data-driven
- **WHEN** a wall is generated with 2 or 5 columns
- **THEN** it contains 14 or 35 slots respectively with the same per-column structure

### Requirement: Fit rule
A parcel SHALL fit a slot when the parcel's size rank (A < B < C) is less than or equal to the slot's size rank.

#### Scenario: Small parcel in larger slot
- **WHEN** an A parcel is tested against a C slot
- **THEN** the fit result is true

#### Scenario: Large parcel in smaller slot
- **WHEN** a C parcel is tested against a B slot
- **THEN** the fit result is false

### Requirement: Door states
Each slot SHALL be in exactly one state: `empty`, `full` (holds a pickup parcel), `open` (door animating open after a correct pickup), `outgoing` (holds a sender's parcel), `expired` (holds a parcel whose customer walked), or `marked` (flagged for sweep). The rendered door SHALL expose its state and size via `data-state` and `data-size` attributes and SHALL be a `<button>` with an accessible label containing the slot id.

#### Scenario: Rendering reflects state
- **WHEN** the reducer moves slot `c1r2` from `empty` to `full`
- **THEN** the corresponding button's `data-state` attribute becomes `full` and no other slot's attributes change

### Requirement: Whole wall always visible
The wall SHALL fit within the viewport without scrolling on viewports from 360×640 px up for 2 to 5 columns, with door heights computed from available height and clamped between 24 px and 40 px per unit. On viewports narrower than 640 px the screen panel SHALL be placed above the wall; otherwise it SHALL occupy a central column of the wall.

#### Scenario: Small phone portrait
- **WHEN** the game renders a 3-column wall in a 360×640 px viewport
- **THEN** every door is fully inside the viewport and the page has no vertical or horizontal scrollbar

#### Scenario: Five columns on a small phone
- **WHEN** the game renders a 5-column wall in a 360×640 px viewport
- **THEN** every door is fully inside the viewport, A doors are at least 24 px tall, and the page has no scrollbar

#### Scenario: Desktop
- **WHEN** the game renders in a 1280×800 px viewport
- **THEN** the screen panel is rendered between the wall's columns and every door is visible

### Requirement: Enlarged hit areas
Every door SHALL have an effective pointer hit area of at least 40 px in height and width, regardless of its visible size.

#### Scenario: Tapping just outside a small door
- **WHEN** the user taps 6 px below the visible bottom edge of an A door whose visible height is 24 px
- **THEN** the tap is attributed to that door

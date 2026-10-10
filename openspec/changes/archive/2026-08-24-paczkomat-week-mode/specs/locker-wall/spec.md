## MODIFIED Requirements

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

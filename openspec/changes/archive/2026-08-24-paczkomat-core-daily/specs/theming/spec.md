## ADDED Requirements

### Requirement: Token-driven styling
All colours, radii, fonts, shadows and motion durations SHALL be CSS custom properties defined on `:root` and overridden per `[data-theme]`. Files under `src/core/` and `src/ui/` SHALL contain no colour literals.

#### Scenario: No colour literals in code
- **WHEN** `src/core` and `src/ui` are scanned for hex, rgb() or hsl() colour literals
- **THEN** none are found

### Requirement: Signage theme
The default theme `signage` SHALL use an off-white background, near-black ink, a single vermilion accent, and a bundled open-licence grotesk typeface with Latin Extended glyphs so Polish diacritics render in the same face.

#### Scenario: Diacritics in bundled face
- **WHEN** the string "Dzień · Kolejka" is rendered
- **THEN** all glyphs come from the bundled typeface

### Requirement: State-driven visuals
Door visuals SHALL derive solely from `data-state`, `data-size` and `data-hint` attributes; parcel colour and sticker visuals SHALL derive from `data-colour` and `data-sticker`, mapped to tokens in the theme.

#### Scenario: Theme swap without re-render
- **WHEN** `data-theme` on the root element changes
- **THEN** every door and parcel restyles with no DOM mutation by game code

### Requirement: Scenery slot
A scenery container SHALL precede the wall in the DOM and SHALL be empty and zero-height in the signage theme.

#### Scenario: Scenery present
- **WHEN** the game screen renders
- **THEN** an element with class `scenery` exists before the wall and has zero height

### Requirement: Reduced motion
When `prefers-reduced-motion: reduce` is set, door and screen animations SHALL complete instantly while game timing is unchanged.

#### Scenario: Door open with reduced motion
- **WHEN** a correct door is tapped with reduced motion enabled
- **THEN** the door shows its open state immediately and the slot empties on the same schedule as without reduced motion

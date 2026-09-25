# day-events Specification

## Purpose
In-day events for Week runs: jammed doors, forgotten codes, rain-masked codes, the late van, and their seeded determinism.

## Requirements

### Requirement: Jammed door
At a scheduled time in SERVE a seeded slot SHALL become jammed and display a jam marker. A jammed slot SHALL reject senders (wrong tap). For a pickup whose parcel is in a jammed slot, the first correct tap SHALL un-jam without penalty and without opening; the second correct tap SHALL open the door. Jam SHALL clear when the door opens or when SWEEP begins.

#### Scenario: Two taps to open
- **WHEN** the active pickup's parcel is in a jammed slot and the user taps it twice
- **THEN** after the first tap the slot is un-jammed and still `full`; after the second it is `open`

#### Scenario: Sender rejected
- **WHEN** the active sender taps an empty jammed slot of sufficient size
- **THEN** it is a wrong tap and the slot stays empty

### Requirement: Forgotten code
A customer flagged `forgotten` SHALL be presented without a code and with a description line of size, colour and sticker. The hint ladder SHALL apply unchanged.

#### Scenario: Description only
- **WHEN** a forgotten-code pickup becomes active
- **THEN** the screen shows no digits and shows the description line

### Requirement: Rain
On a rain day every displayed pickup code SHALL have one seeded digit position masked with `•`; the masked position SHALL never be one of the transposed positions of a look-alike pair; descriptions SHALL be unaffected.

#### Scenario: Masked code
- **WHEN** a pickup with code 4821 is active on a rain day with masked index 2
- **THEN** the screen shows `48•1`

#### Scenario: Mask avoids pair positions
- **WHEN** codes 4821 and 4812 form a look-alike pair on a rain day
- **THEN** the masked index is not 2 or 3

### Requirement: Late van
On a late-van day the LOAD duration SHALL be 60 % of the profile value and the HUD SHALL show a late-van note during LOAD.

#### Scenario: Shortened load
- **WHEN** Friday starts with LOAD 40 s and late van
- **THEN** the LOAD timer is 24 s

### Requirement: Event determinism
Jam slots and times, forgotten-code customers, and rain mask positions SHALL be derived from the day seed and SHALL be identical across replays of the same seed.

#### Scenario: Replay
- **WHEN** Saturday with seed 99 is generated twice
- **THEN** the jam slot, jam time, forgotten customers and mask index are identical

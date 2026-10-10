## ADDED Requirements

### Requirement: Parcel identity
Each generated parcel SHALL have a unique id, a size in {A, B, C}, a 4-digit code unique within the day, a colour from the six tokens `red, orange, yellow, green, blue, violet`, and a sticker from `none, fragile, arrow, bang`.

#### Scenario: Codes are unique
- **WHEN** 20 parcels are generated for one day
- **THEN** all 20 codes are distinct 4-digit strings

### Requirement: Seeded determinism
Parcel generation SHALL depend only on the seed and the day profile; the same inputs SHALL produce identical parcels in identical order, and `Math.random` SHALL NOT be used anywhere under `src/core/`.

#### Scenario: Same seed, same parcels
- **WHEN** the generator runs twice with seed 12345 and the same profile
- **THEN** both runs produce deep-equal parcel lists

#### Scenario: Different seed, different parcels
- **WHEN** the generator runs with seeds 1 and 2
- **THEN** the parcel lists differ

### Requirement: Look-alike code pairs
The generator SHALL produce the number of look-alike pairs requested by the profile, where each pair consists of two codes that differ only by swapping two adjacent digits, and both parcels of a pair SHALL be pickups.

#### Scenario: Two pairs requested
- **WHEN** the profile requests 2 look-alike pairs
- **THEN** exactly 2 pairs of pickup parcels exist whose codes differ by one adjacent transposition, and no other codes form such a pair

### Requirement: Size mix respects wall capacity
The generator SHALL produce a parcel size mix for which a fitting placement of all pickup parcels into the day's wall exists.

#### Scenario: Feasible load
- **WHEN** 16 pickup parcels are generated for a 3-column wall
- **THEN** a placement assigning every parcel to a distinct fitting slot exists

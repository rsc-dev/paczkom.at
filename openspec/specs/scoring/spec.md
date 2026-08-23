# scoring Specification

## Purpose
Scoring rules: service points scaled by customer wait, penalties with a zero floor, and total-time accounting.

## Requirements

### Requirement: Service points
Serving a customer SHALL award `round(100 × m)` points where `m = 1 + clamp((P − w) / P, 0, 1)`, `P` is the profile patience in seconds and `w` is the seconds the customer waited while visible.

#### Scenario: Instant service
- **WHEN** a customer is served after waiting 0 s with P = 20
- **THEN** 200 points are awarded

#### Scenario: Late service
- **WHEN** a customer is served after waiting 20 s with P = 20
- **THEN** 100 points are awarded

### Requirement: Penalties
Each wrong tap SHALL deduct 25 points; each refused sender 100; each walked pickup 50; each parcel unplaced at the end of LOAD 50. The day score SHALL never be below 0.

#### Scenario: Floor at zero
- **WHEN** the running score is 20 and a wrong tap occurs
- **THEN** the score is 0

### Requirement: Total time
Total time SHALL be the sum of elapsed LOAD, SERVE and SWEEP time in ms, where LOAD and SERVE elapsed time stops at early completion.

#### Scenario: Early load
- **WHEN** LOAD completes after 12 s of a 25 s timer
- **THEN** 12 000 ms is contributed by LOAD

## ADDED Requirements

### Requirement: Pure reducer
The day SHALL be driven by a pure function `reduce(state, action)` that depends only on its arguments. Time SHALL enter exclusively via `tick(dtMs)` actions. Replaying the same seed and action sequence SHALL yield a deep-equal final state.

#### Scenario: Replay determinism
- **WHEN** a recorded action log is applied twice to the initial state for seed 777
- **THEN** the two final states are deep-equal

### Requirement: Phase order
A day SHALL progress LOAD → SERVE → SWEEP → SUMMARY and never backwards.

#### Scenario: Load timer expires
- **WHEN** the LOAD phase has received ticks totalling its duration
- **THEN** the phase is SERVE and any unplaced parcels are removed from the day and counted as `unplaced`

#### Scenario: Sweep completes
- **WHEN** the last marked door is tapped in SWEEP
- **THEN** the phase is SUMMARY

### Requirement: LOAD placement
During LOAD the current parcel SHALL be the head of the load queue with the next two parcels visible. `tapSlot` on an empty slot that fits the current parcel SHALL place it there and advance the queue; `tapSlot` on an occupied or non-fitting slot SHALL be ignored with a `wrong` feedback cue and no penalty.

#### Scenario: Valid placement
- **WHEN** the current parcel is size B and the user taps an empty C slot
- **THEN** the slot becomes `full` with that parcel and the next parcel becomes current

#### Scenario: Invalid placement
- **WHEN** the current parcel is size C and the user taps an empty A slot
- **THEN** state is unchanged except for a `wrong` feedback flag

#### Scenario: Queue exhausted early
- **WHEN** all parcels are placed before the LOAD timer expires
- **THEN** the phase becomes SERVE immediately

### Requirement: Customer queue
During SERVE customers SHALL arrive at their scheduled times. At most 3 customers SHALL be visible; further arrivals are pending and do not drain patience until visible. The active customer SHALL default to the front of the visible queue; `selectCustomer(id)` SHALL make any visible customer active.

#### Scenario: Fourth arrival is pending
- **WHEN** three customers are visible and a fourth arrives
- **THEN** the fourth is pending with full patience

#### Scenario: Selecting a customer
- **WHEN** the user selects the second visible customer
- **THEN** that customer becomes active and the screen shows their request

### Requirement: Pickup service
For an active pickup customer, `tapSlot` on the slot holding their parcel SHALL set the slot to `open`, then `empty` after the door animation duration, remove the customer, and record the outcome. Any other slot SHALL count as a wrong tap.

#### Scenario: Correct door first try
- **WHEN** the active pickup's parcel is in `c0r3` and the user taps `c0r3` with hint level 0 and no prior wrong taps for this customer
- **THEN** the slot outcome is `perfect`, the customer leaves and the slot becomes `empty`

#### Scenario: Wrong door
- **WHEN** the user taps a slot that does not hold the active pickup's parcel
- **THEN** the customer's wrong-tap count increments, a `wrong` cue fires and the slot state is unchanged

### Requirement: Hint ladder
For an active pickup, hint level SHALL become 1 after the first wrong tap or after 6 s active without a tap, and level 2 after the second wrong tap or after 12 s active. Level 1 SHALL reveal the parcel's colour and sticker on the screen; level 2 SHALL additionally mark the column containing the parcel with `data-hint="column"`. Levels SHALL reset when the active customer changes.

#### Scenario: Time-based hint
- **WHEN** a pickup has been active for 6 s with no taps
- **THEN** hint level is 1 and the screen shows the colour swatch

#### Scenario: Second mistake
- **WHEN** the user makes a second wrong tap for the same pickup
- **THEN** hint level is 2 and the parcel's column has `data-hint="column"`

#### Scenario: Served after hint
- **WHEN** the correct door is tapped at hint level ≥ 1
- **THEN** the slot outcome is `hinted`

### Requirement: Sender service
For an active sender needing size S, `tapSlot` on an `empty` slot with size ≥ S SHALL place an outgoing parcel there (slot state `outgoing`) and remove the customer. Any other slot SHALL count as a wrong tap. Senders SHALL NOT receive hints.

#### Scenario: Sender placed
- **WHEN** the active sender needs size B and the user taps an empty B slot
- **THEN** the slot becomes `outgoing` and the customer leaves

#### Scenario: No fitting slot
- **WHEN** the active sender needs size C and the user taps an empty A slot
- **THEN** it is a wrong tap and the sender remains

### Requirement: Patience
Each visible customer SHALL have patience that drains at 1 s per second from a profile-defined maximum. At zero the customer SHALL walk: a pickup's parcel stays in its slot and the slot becomes `expired`; a sender is counted as `refused`.

#### Scenario: Pickup walks
- **WHEN** a visible pickup's patience reaches zero
- **THEN** the customer is removed, their slot is `expired` and its outcome is `walked`

#### Scenario: Sender walks
- **WHEN** a visible sender's patience reaches zero
- **THEN** the customer is removed and the `refused` count increments

### Requirement: SERVE end
SERVE SHALL end when the serve timer expires or when no customers remain (visible or pending); any remaining customers at timer expiry SHALL walk.

#### Scenario: Timer expiry with customers waiting
- **WHEN** the serve timer expires with two customers visible
- **THEN** both walk and the phase becomes SWEEP

### Requirement: SWEEP
On entering SWEEP every `outgoing` and `expired` slot SHALL become `marked`. `tapSlot` on a marked slot SHALL make it `empty`; taps elsewhere SHALL be ignored. SWEEP SHALL be untimed but its elapsed time SHALL count toward total time. If no slots are marked, SWEEP SHALL be skipped.

#### Scenario: Clearing marked doors
- **WHEN** two slots are marked and the user taps both
- **THEN** both are `empty` and the phase is SUMMARY

### Requirement: Day summary
The SUMMARY state SHALL contain the score, total time in ms, per-slot outcomes, and counts of served, hinted, walked, refused, unplaced, and wrong taps.

#### Scenario: Summary fields
- **WHEN** a day reaches SUMMARY
- **THEN** all listed fields are present and consistent with the action log

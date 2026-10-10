## MODIFIED Requirements

### Requirement: Daily profile
Daily SHALL use the Thursday profile: 3 columns, 15 pickups, 4 senders, 2 look-alike pairs, one jammed door, LOAD 25 s, SERVE 65 s, patience 20 s.

#### Scenario: Profile applied
- **WHEN** a Daily day is started
- **THEN** the wall has 21 slots, the load queue has 15 parcels, and the schedule contains one jam entry

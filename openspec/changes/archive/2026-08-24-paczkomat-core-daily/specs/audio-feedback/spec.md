## ADDED Requirements

### Requirement: Synthesised cues
The game SHALL play four synthesised cues without audio files: `tap` on any accepted tap, `door` on a door opening, `wrong` on a wrong tap, and `done` on reaching SUMMARY.

#### Scenario: Wrong tap cue
- **WHEN** a wrong tap occurs and audio is unmuted
- **THEN** the `wrong` cue is triggered exactly once

### Requirement: Gesture-gated context
The `AudioContext` SHALL be created only after the first user pointer event and never while muted.

#### Scenario: Muted at boot
- **WHEN** the stored mute preference is true
- **THEN** no `AudioContext` is created during the session

### Requirement: Mute toggle
A visible mute toggle SHALL persist its state and silence all cues immediately.

#### Scenario: Mute mid-game
- **WHEN** the user mutes during SERVE
- **THEN** subsequent cues are not audible and the preference is stored

## MODIFIED Requirements

### Requirement: Namespaced storage
Persisted values SHALL be stored in `localStorage` under keys prefixed `pk:v1:` as JSON. Stored data SHALL include language, theme, mute, per-date Daily records, best score, best week total, and the Week run in progress.

#### Scenario: Write and read
- **WHEN** `set("lang", "en")` is called and the page reloads
- **THEN** `get("lang")` returns `"en"`

#### Scenario: Week run survives a reload
- **WHEN** a Week run is saved under `week:run` and the page reloads
- **THEN** `get("week:run")` returns the same run state

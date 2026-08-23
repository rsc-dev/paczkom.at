## ADDED Requirements

### Requirement: Namespaced storage
Persisted values SHALL be stored in `localStorage` under keys prefixed `pk:v1:` as JSON. Stored data SHALL include language, theme, mute, per-date Daily records, and best score.

#### Scenario: Write and read
- **WHEN** `set("lang", "en")` is called and the page reloads
- **THEN** `get("lang")` returns `"en"`

### Requirement: Storage fallback
If `localStorage` throws on access or write, the storage layer SHALL fall back to an in-memory map for the session and the game SHALL remain fully playable.

#### Scenario: Storage unavailable
- **WHEN** `localStorage` access throws
- **THEN** reads and writes succeed in memory and no error reaches the UI

### Requirement: Corrupt value tolerance
A stored value that fails to parse SHALL be treated as absent.

#### Scenario: Invalid JSON
- **WHEN** a key holds the string `{not json`
- **THEN** `get` returns `undefined`

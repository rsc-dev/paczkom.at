# paczkom.at — daily smog card

Date: 2026-10-01 · Status: design approved in conversation, awaiting spec review

## Goal

Replace the parcel-locker game at paczkom.at with a product of our own: an
hourly air-quality card for the reader's town, built only on open data,
shareable like the game's Daily result. Not another live map — maps of these
sources already exist (GIOŚ, Airly, InPost's app, szkocot/air-quality-map).

Success: a reader picks a town once, comes back and sees in one phone screen how
the air is now, compared with yesterday and with the rest of Poland, and can
share it with a link that previews correctly.

## Decisions taken

| Question | Decision |
| --- | --- |
| Product | Daily smog card, not a map, not InPost data |
| Game | Replaced; code removed from `main`, tagged `game-final` |
| Core view | The reader's own town; national ranking one tap away |
| Freshness | Hourly |
| Pipeline | GitHub Actions cron builds JSON + static pages and deploys Pages (approach A) |
| Collector language | TypeScript in this repo (Node already runs CI/build/tests), not Python |

Explicitly out of v1: InPost data, maps, forecasts, NO₂/O₃ from citizen
sensors, push notifications, long-term archive, accounts, analytics.

## 1. Data and grading

### Sources

- **GIOŚ** (`api.gios.gov.pl/pjp-api/v1/rest`): `station/findAll` (288 stations,
  216 towns on 2026-10-01) and `aqindex/getIndex/{stationId}`, one call per
  station per run. Returns the official index 0–5 and its category name.
  The official index is the worst of all pollutants measured (PM10, PM2.5, SO₂,
  NO₂, CO, C₆H₆, O₃), so it can be worse than a PM-only grade.
- **Sensor.Community** (`data.sensor.community/airrohr/v1/filter/country=PL`):
  one bulk call, ~670 PM2.5 sensors in Poland on 2026-10-01. Readings carry
  coordinates only (`exact_location: 0` means fuzzed), no town. Licence ODbL 1.0
  — attribution required.
- **Towns**: GeoNames Polish populated places with population ≥ 5 000, vendored
  as a generated JSON file (name, ASCII slug, lat/lon, population). CC BY 4.0 —
  attribution required.

### Scale

The Polski Indeks Jakości Powietrza, six levels, index 0–5, shown to readers as
1–6:

| Level | PL | EN | PM2.5 µg/m³ | PM10 µg/m³ |
| --- | --- | --- | --- | --- |
| 1 | Bardzo dobry | Very good | 0–13 | 0–20 |
| 2 | Dobry | Good | 13.1–35 | 20.1–50 |
| 3 | Umiarkowany | Moderate | 35.1–55 | 50.1–80 |
| 4 | Dostateczny | Sufficient | 55.1–75 | 80.1–110 |
| 5 | Zły | Bad | 75.1–110 | 110.1–150 |
| 6 | Bardzo zły | Very bad | > 110 | > 150 |

Bands exclude the lower bound and include the upper; no rounding. Levels 1–2
are confirmed against IOŚ-PIB; **levels 3–6 must be confirmed against
powietrze.gios.gov.pl before the grading module is implemented** (taken from a
secondary source). A PM-only grade is the worse of the PM2.5 and PM10 levels.

### Sensor → town

Each outdoor Sensor.Community sensor is assigned to the nearest town whose
radius contains it: radius = clamp(2 km × √(population / 10 000), 3 km, 15 km).
Sensors outside every radius are ignored.

### A town's grade for the hour

1. **GIOŚ first.** If the town has GIOŚ stations with an index for the hour, the
   town's level is the worst of them. Source: `gios`. `getIndex` returns
   levels, not concentrations, so a GIOŚ town's PM2.5/PM10 values come from the
   median of its citizen sensors when it has any (labelled as such); otherwise
   they are null and the card and share text omit the PM line.
2. **Otherwise citizen sensors.** Drop: indoor sensors; readings older than 2 h;
   PM2.5 or PM10 ≤ 0 or > 1 000; PM2.5 > PM10 + 5 (sensor fault). Take the
   median PM2.5 and median PM10 of what remains and grade them. Source:
   `citizen`, with sensor count.
   - `lowConfidence` when fewer than 3 sensors, or median relative humidity
     (from the same sensors, where reported) > 80 %.
3. **Otherwise** `noData`. Never interpolate from neighbours.

### Published data

- `data/towns/<slug>.json` per town: name, slug, level (or null), pm25, pm10
  (null when no citizen sensor covers the town), source, sensorCount, lowConfidence,
  worstToday {level, hour}, levelYesterday (same hour, 24 h ago, or null),
  percentileBetter (share of towns with data that have a worse level),
  updatedAt.
- `data/national.json`: updatedAt, median level, count per level, five best and
  five worst towns (ties broken by PM2.5 then name), towns with data / total.
- `data/index.json`: slug, name, lat, lon for the town picker.

### History

A rolling 48 h of per-town hourly levels and PM values, stored as one JSON file
uploaded as a workflow artifact by each run and downloaded by the next. Lost
artifact → the run starts fresh; `levelYesterday` and `worstToday` are null
until history refills. "Today" means the Europe/Warsaw calendar day.

## 2. The town page

- **First visit**: town search with typeahead over `data/index.json` (matches
  with and without Polish diacritics), and "Użyj mojej lokalizacji / Use my
  location", which uses the Geolocation API and picks the nearest town in the
  browser. The position is never sent anywhere. The chosen slug is stored in
  `localStorage`; later visits open straight on it.
- **Card**: town name; a large block in the level colour with label and
  "n/6"; PM2.5 and PM10 in µg/m³; vs same hour yesterday (↑ worse, ↓ better,
  = same); worst hour today; "Lepiej niż 64% miast w Polsce / Better than 64% of
  towns in Poland"; source line ("Oficjalna stacja GIOŚ" or "Mediana 7 czujników
  obywatelskich", plus "niska pewność / low confidence" when flagged) with update
  time. Actions: change town, share, national ranking.
- **Ranking view**: national median level, five best and five worst towns,
  count per level. A list, not a map.
- **Language**: PL default, EN toggle, reusing the game's i18n module and its
  persisted choice.
- **Freshness**: if `updatedAt` is older than 3 h, a visible warning ("Dane z
  14:00 — odświeżanie się opóźnia"). If data cannot load, "Brak danych —
  spróbuj za chwilę" instead of an empty card.
- **Links**: `paczkom.at/<slug>/` opens that town (see §3). Opening a shared
  town does not overwrite the reader's own saved town; the card offers "Ustaw
  jako moje miasto / Make this my town".
- **Accessibility**: level is always label + number, never colour alone; the
  six colours are checked for colour-blind distinguishability and text
  contrast (WCAG AA).

## 3. Sharing

Share text, via the Web Share API with the existing clipboard fallback:

```
paczkom.at · Kraków · 1 paź, 17:00
🟠 Dostateczne (4/6)
PM2.5 48 µg/m³ · gorzej niż wczoraj ↑
Lepiej niż 36% miast w Polsce
https://paczkom.at/krakow
```

Lines whose data is missing are omitted (no "yesterday" line without history).
Emoji per level: 🟢 🟢 🟡 🟠 🔴 🟣 (levels 1–2 share green; the label
disambiguates).

Link previews: crawlers do not run JavaScript, so each hourly build generates a
static `/<slug>/index.html` per town — the same app shell with that town's
`og:title`, `og:description`, `og:url` and `og:image` — plus
`/<slug>/og.png` (1200×630: town, level colour and label, PM2.5, date and
time), drawn with the existing PNG encoder used for the game's `og.png`.
A few hundred pages and images, a few MB per deploy. Platforms cache previews
(Facebook for days); the image always states its time and no cache-busting is
attempted.

No tracking, accounts or link shorteners.

## 4. Replacing the game, operations, testing

### The game

- Tag the last game commit `game-final`; remove game code, tests, e2e specs and
  game-only assets from `main`. Keep: i18n, share/clipboard, PNG encoder,
  icon/og generator, site shell tests that still apply.
- `/` and `/?week=…` land on the smog card; with `?week=` present, a single line
  "Gra została wyłączona / The game has been retired". Game `localStorage` keys
  are left untouched and never read.
- Manifest, title, description, og tags and README rewritten for the new
  product. The README's trade-mark note stays in force: no InPost data, no
  "Paczkomat" wording.
- Footer attribution: GIOŚ (dane: Główny Inspektorat Ochrony Środowiska),
  Sensor.Community (ODbL), GeoNames (CC BY 4.0).

### Pipeline

- `deploy.yml` gains `schedule: cron '25 * * * *'` (GIOŚ computes the index
  around :20) and keeps push-to-`main` and manual triggers; all go through
  collect → build → validate → deploy, with a concurrency group so runs never
  overlap. Scheduled runs may start 5–20 min late; the card shows real
  `updatedAt`.
- Collector: `scripts/collect.ts` fetches both sources with timeouts and
  limited concurrency for the 288 GIOŚ calls, merges with history, grades,
  writes `public/data/**` and the per-town pages and images.
- Failure handling: one source failing → publish with the other (source lines
  reflect it). Both failing, or fewer than 50 towns with a level → fail the run
  without deploying; the previous deploy stays live and the 3 h staleness
  warning shows.
- Output is validated against its schema (TypeScript types + a runtime check)
  before deploy.
- GitHub disables scheduled workflows in public repos after 60 days without
  activity: a monthly `keepalive.yml` commits a timestamp to a file to keep the
  schedule alive.

### Testing

- Unit: level thresholds at every band edge, PM-only worse-of rule, sensor →
  town assignment and radius, filters (indoor, stale, impossible, PM2.5 > PM10),
  median, low-confidence rules, GIOŚ-first selection, percentile, best/worst
  ordering and ties, history merge and Europe/Warsaw day boundary, share text
  with and without missing lines, og image dimensions.
- Contract: recorded fixtures of both source responses drive the collector in
  CI; CI never calls live sources.
- E2E (Chromium): first visit + search (with and without diacritics), remembered
  town, `/<slug>/` not overwriting the saved town, staleness warning, no-data
  state, ranking view, EN toggle, `?week=` notice.
- Live check: a daily workflow calls both live sources and fails loudly on a
  shape change.

## Open items before implementation

- Confirm PM bands for levels 3–6 against powietrze.gios.gov.pl.
- Confirm GIOŚ API usage terms and any rate limit (none observed in headers).
- Pick the six level colours and verify contrast.

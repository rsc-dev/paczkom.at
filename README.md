# paczkom.at

Hourly air quality for your town, on one phone screen: today's level on the
Polish air-quality index, compared with the same hour yesterday and with the rest
of Poland, with a link you can share that previews as your town.

No backend, no accounts, no tracking, no runtime dependencies. An hourly GitHub
Actions job fetches open data, grades every town, and publishes static JSON and
one page per town to GitHub Pages.

The site used to host a parcel-locker memory game; its last version is the git
tag `game-final`.

## How a town is graded

1. **GIOŚ first.** If the town has an official GIOŚ station with a fresh index,
   the town's level is the worst of its stations. That index counts every
   pollutant GIOŚ measures, not only dust.
2. **Otherwise citizen sensors.** Outdoor Sensor.Community sensors within the
   town's radius (3–15 km, growing with population) are filtered (stale,
   impossible, PM2.5 above PM10) and their median PM2.5 and PM10 are graded on
   the same index. Fewer than three sensors, or humid air (median humidity
   over 80 %, where cheap optical sensors read high), shows "low confidence".
3. **Otherwise no data.** Never a guess from neighbouring towns.

| Level | PL | PM2.5 µg/m³ | PM10 µg/m³ |
| --- | --- | --- | --- |
| 1 | Bardzo dobry | 0–13 | 0–20 |
| 2 | Dobry | 13.1–35 | 20.1–50 |
| 3 | Umiarkowany | 35.1–55 | 50.1–80 |
| 4 | Dostateczny | 55.1–75 | 80.1–110 |
| 5 | Zły | 75.1–110 | 110.1–150 |
| 6 | Bardzo zły | > 110 | > 150 |

## Requirements

- Node `^20.19 || >=22.13` and npm
- `unzip` (only for `npm run gen:towns`)

## Install

    npm ci

For the end-to-end suite, also fetch the browser it drives:
`npx playwright install --with-deps chromium`.

## Develop

    npm run build
    npm run collect -- --fixtures scripts/collect/fixtures --now 2026-10-01T17:12:00Z --history /tmp/history.json
    npx vite preview

The collector writes into `dist/` after the build, so preview the build rather
than the dev server. With `--fixtures` it uses recorded responses and no
network; without it, it fetches both live sources.

- `npm run record:fixtures` — re-record the fixtures from the live sources.
- `npm run gen:towns` — regenerate `src/data/towns.json` from GeoNames. Towns of
  5 000+ that GeoNames does not code as an administrative seat can be added by id
  in `scripts/towns/include.json`.
- `npm run gen:icons` — regenerate the icons and the site-wide `og.png`.

## Test

    npm run typecheck
    npm run lint
    npm test
    npm run test:e2e

The e2e suite runs against the built site with fixture data (see `ci.yml`).

## Build

    npm run build && npm run collect

## Deploy

`deploy.yml` runs on every green CI on `main`, on demand, and every hour at :25
(GIOŚ publishes its index around :20). Each run builds, restores the 48-hour
history from the Actions cache, collects, saves the history, and deploys to
GitHub Pages. A run that gets nothing from both sources, or grades fewer than
50 towns, fails without deploying: the previous hour stays live and the page
warns when its data is more than three hours old.

`keepalive.yml` commits once a month so GitHub does not disable the hourly
schedule (it does after 60 days without activity in a public repository).
`live-check.yml` fetches both sources daily and fails if either changes shape.

GitHub Pages settings: source **GitHub Actions**, custom domain `paczkom.at`,
**Enforce HTTPS** on. DNS at OVH: apex A/AAAA to GitHub Pages, `www` CNAME to
`rsc-dev.github.io.`

## Data and attribution

- Air-quality index: Główny Inspektorat Ochrony Środowiska (GIOŚ),
  https://powietrze.gios.gov.pl
- Citizen sensors: Sensor.Community, Open Database License (ODbL) 1.0
- Towns: GeoNames, CC BY 4.0
- Inter typeface: SIL Open Font License 1.1 (`public/fonts/Inter-LICENSE.txt`,
  `scripts/assets/Inter-LICENSE.txt`)

Citizen-sensor readings are indicative, not official measurements.

## A note on the name

"Paczkomat" is a registered trade mark of a parcel-locker operator. This site is
not affiliated with any of them, uses none of their branding or data, and a test
keeps the word out of every page and string.

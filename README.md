# paczkom.at

A two-minute browser game about the one thing a parcel locker is really good
at: remembering which box the parcel went into.

A day runs in three phases. **Load** the wall as the courier — each parcel has to
go in a box it fits. **Serve** the customers as the locker's memory — they give
you a code, you open the right door. **Sweep** what is left behind. One seeded
day per UTC date, the same for everyone, with a shareable emoji grid at the end.

No backend, no accounts, no tracking, and no runtime dependencies: the whole
thing is a static page of hand-written TypeScript and CSS.

## Requirements

- Node `^20.19 || >=22.13` (CI runs 22) — the version Vite 8 needs
- npm (the lockfile is committed; use `npm ci` for a reproducible install)

## Install

```sh
npm ci
```

For the end-to-end suite, also fetch the browser it drives:

```sh
npx playwright install --with-deps chromium
```

## Develop

```sh
npm run dev        # Vite dev server with hot reload
```

## Test

```sh
npm run typecheck  # tsc --noEmit
npm run lint       # eslint
npm test           # vitest: unit tests and the scripted-day fixtures
npm run test:e2e   # Playwright: smoke test and viewport checks against the build
```

The e2e suite builds nothing itself — it starts `vite preview` against `dist/`,
so run `npm run build` first (or let CI do it). It also writes the viewport
screenshots it checks into `test-results/screens/`, which CI keeps as an
artefact on every run.

Two generators regenerate committed artefacts. Run them only when you mean to
change what they produce, and review the diff:

```sh
npm run gen:fixtures   # -> src/core/fixtures/scripted-days.ts
npm run gen:icons      # -> public/icon-*.png, public/apple-touch-icon.png
```

The scripted days are the regression net for the whole game loop: a seed, a
static action log and the summary the reducer must still produce. A fixture
that moves is a rule that moved.

## Build

```sh
npm run build      # -> dist/
npm run preview    # serve dist/ locally
```

## How it is put together

```
src/core/     the rules: a pure reducer, seeded RNG, no DOM and no clock
src/ui/       the view: builds a stable DOM tree, writes data-* attributes
src/theme/    every colour, radius, font and duration, as CSS custom properties
src/i18n/     Polish and English catalogues with a shared key set
src/audio/    four synthesised cues, no audio files
e2e/          Playwright: the smoke test and the viewport checks
```

Three rules hold the design together:

- **`src/core` is pure.** No DOM, no `Math.random`, no `Date.now`. Time enters
  through `tick(dtMs)` actions only, so a whole day replays from
  `seed + action log`. A lint rule and a test both enforce it.
- **Nothing outside `src/theme` names a colour.** Doors carry `data-state`,
  `data-size` and `data-hint`; parcels carry `data-colour` and `data-sticker`.
  A test fails the build on any hex, `rgb()` or `hsl()` in `src/core` or
  `src/ui`. A new theme is a CSS file and nothing else.
- **The wall never scrolls.** Door height is `minmax(24px, 1fr)` inside a stage
  capped at 40 px per unit, and every door has a hit area of at least 40 px
  whatever it looks like. The viewport suite checks this at 360×640, 390×844
  and 1280×800.

## Deploy

Push to `main`. CI runs typecheck, lint, unit tests, the build and the Chromium
smoke test; only when it is green does `deploy.yml` publish `dist/` to GitHub
Pages via `upload-pages-artifact` and `deploy-pages`.

### Before the first deploy

1. **Set the launch date.** `LAUNCH_EPOCH` in `src/core/daily.ts` is the date
   that counts as Daily #1. It currently holds the placeholder `2026-09-01`.
   Set it to the real launch date, or the Daily number will be wrong from the
   first day.
2. **Enable Pages.** Repository → Settings → Pages → Source: **GitHub Actions**.
3. **Set the custom domain** to `paczkom.at` in the same settings page. That
   repository setting is what Pages actually serves from; `public/CNAME` ships
   the same value with the build so the two cannot silently disagree.
4. **Point DNS at GitHub Pages.** At the registrar for `paczkom.at`:

   | Record | Name  | Value                                                              |
   | ------ | ----- | ------------------------------------------------------------------ |
   | A      | `@`   | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
   | AAAA   | `@`   | `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153` |
   | CNAME  | `www` | `<owner>.github.io.`                                               |

   Until DNS propagates the site is reachable at the `github.io` URL. Once it
   has, tick **Enforce HTTPS** in the Pages settings.

Rolling back is `git revert` on `main`: the deploy workflow republishes the
previous build.

## A note on the name

"Paczkomat" is a registered trade mark of a parcel-locker operator. This game is
not affiliated with any of them, uses none of their branding, and calls the
machine what it is: an *automat paczkowy* in Polish, a *parcel locker* in
English. A test scans both string catalogues to keep it that way.

Inter is bundled under the SIL Open Font License 1.1
(`public/fonts/Inter-LICENSE.txt`). The four `.woff2` files in `public/fonts/`
were copied out of the `@fontsource/inter` package, which is a devDependency
only for that reason — nothing imports it, and removing it would not change the
build.

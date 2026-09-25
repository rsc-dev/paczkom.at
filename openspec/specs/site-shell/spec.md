# site-shell Specification

## Purpose
The site around the game: screens, installable static build output, zero runtime dependencies, CI gate, GitHub Pages deployment, and README.

## Requirements

### Requirement: Screens
The site SHALL provide a title screen (name, Daily button, Week button, a continue-week action shown only while a Week run is saved, how-to button, PL/EN toggle, mute toggle, streak, best week), a how-to screen explaining LOAD/SERVE/SWEEP, events and stars in short steps, the game screen, the Daily result screen, the day-summary screen, the week-summary screen and the Reklamacja screen. All screens SHALL be reachable without page navigation.

#### Scenario: Title to game
- **WHEN** the user taps the Daily button on the title screen
- **THEN** the game screen appears in LOAD phase

#### Scenario: Title to week
- **WHEN** the user taps the Week button on the title screen
- **THEN** the game screen appears in LOAD phase with the Monday profile and the URL contains `?week=`

#### Scenario: Title with a saved week
- **WHEN** a Week run is saved at Thursday and the title screen renders
- **THEN** a continue action naming Thursday is visible, and it is hidden again once no run is saved

### Requirement: Installable static site
The build SHALL emit a single `index.html`, a web manifest with name, icons and standalone display, a favicon, and a `CNAME` file containing `paczkom.at`.

#### Scenario: Build output
- **WHEN** `vite build` completes
- **THEN** `dist/` contains `index.html`, `manifest.webmanifest`, `CNAME` with `paczkom.at`, and icon files

### Requirement: Zero runtime dependencies
`package.json` SHALL declare no `dependencies`; all packages SHALL be `devDependencies`.

#### Scenario: Dependency audit
- **WHEN** `package.json` is inspected
- **THEN** the `dependencies` field is absent or empty

### Requirement: CI gate
On every push and pull request, CI SHALL run type-checking, linting, unit tests, the production build, and a Chromium smoke test against the built output, and SHALL fail on any error.

#### Scenario: Failing test blocks
- **WHEN** a unit test fails on a pull request
- **THEN** the CI check is red

### Requirement: GitHub Pages deployment
On push to `main` with CI green, the built `dist/` SHALL be deployed to GitHub Pages via the Pages actions, serving the site at the custom domain.

#### Scenario: Deploy on main
- **WHEN** a commit lands on `main` and CI passes
- **THEN** the deploy workflow publishes `dist/` and the Pages environment URL resolves to the site

### Requirement: README
`README.md` SHALL document prerequisites, install, dev server, tests, build, deployment and DNS setup for the custom domain.

#### Scenario: Fresh clone
- **WHEN** a developer follows the README on a machine with Node installed
- **THEN** they can run the dev server and the test suite

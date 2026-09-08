# Control Tower

A live freight command centre for Indian enterprise logistics — a single operations
console that answers one question continuously: **which of my shipments need
attention right now, and why.**

Built as a portfolio piece modelled on the Track module of an AI-native TMS.
There is no backend. A seeded generator builds a fleet of full-truckload trips and
a tick engine drives them through real Indian geography in accelerated time, with
exceptions emerging from rules rather than being hardcoded.

The full build plan lives in [`docs/build-spec.html`](docs/build-spec.html) — eight
phases, what ships in each, and the checkpoints that gate them.

---

## Running it

```bash
npm install
npm run dev
```

| Script | Does |
| --- | --- |
| `npm run dev` | Vite dev server on :5173 |
| `npm run build` | Typecheck (`tsc -b`) then production build |
| `npm run preview` | Serve the production build |
| `npm run lint` | oxlint |

## Stack

React 19 · TypeScript · Vite 8 · Tailwind CSS v4.

**Two runtime dependencies: `react` and `react-dom`.** Everything else is written
here on purpose, because the parts most worth showing are the parts a package
would otherwise hide:

- the router (`src/app/router.tsx`, ~90 lines over `useSyncExternalStore`)
- the icon set (`src/ui/icons.tsx`)
- the map projection, quadtree and canvas renderer (phase 3)
- the charts (phase 6)

## Layout

```
src/
  styles/tokens.css      the entire palette — the only file holding a raw hex
  lib/                   cx, persisted view preferences
  ui/                    primitives: Button, Chip, Panel, Field, Overlay,
                         Feedback, Table, KeyHint, icons
  app/                   Shell, Rail, Topbar, router, route table
  features/
    track/               control tower  (phases 3–5)
    pulse/               analytics      (phase 6)
    system/              living design-system reference at /system
```

## Design system

`/system` renders every primitive in every state. It exists so the phase-0 exit
criteria are checkable by eye rather than by assertion.

Two colour layers, kept deliberately apart:

- **Brand** — FreightFox's own action blue, navy grounds and mint, used for
  identity and interaction only.
- **Semantic** — `ok` / `info` / `warn` / `crit`, used for freight state and
  exception severity only. Nothing red on this screen is decorative.

Severity is encoded in **shape as well as colour** (critical is a diamond, high a
square, the rest round), so it survives a colour-blind reader and a monochrome
screenshot.

Theming is runtime: `@theme static` emits the palette as `--color-*` custom
properties and `:root[data-theme="dark"]` reassigns the same names, so every
generated utility follows without a rebuild. Density (`comfortable` / `compact`)
works the same way — row height, cell padding and data type size all derive from
`--row-h`, `--row-px` and `--data-size`.

### Contrast

Every rendered text node was audited against its true composited background in
both themes. 182 nodes, zero failures; worst ratio 5.54:1 in dark, 4.70:1 in
light, against a 4.5:1 requirement.

Two things fell out of that audit and shaped the tokens:

- **The accent is two tokens, not one.** `--color-accent` is the accent worn as
  text, icon or border; `--color-accent-solid` is the fill that carries white on
  top. On a dark ground a single value cannot do both jobs and clear 4.5:1 — the
  bright accent gives white only 3.65:1.
- **Four ink tiers, all of them legible.** De-emphasis past the fourth tier is
  done with size and case rather than less contrast.

## The data

No backend. A seeded generator (`mulberry32`) builds the fleet from reference
data that is real where it can be:

| | |
| --- | --- |
| Freight nodes | 70, with real coordinates — Bhiwandi, Dahej, Hosur, Baddi, Sanand, Pantnagar … |
| Lanes | 58 corridors with **road** distances and contracted transit |
| Vehicle classes | 12, at the payloads the market actually books |
| Transporters | 20 (fictional) |
| Commodities | 24 across six industries |
| Exception codes | 10, `EX-01` … `EX-10` |
| Trips | 1,200, generated in well under 150 ms |

Seed 42 by default, so `LR/26/0088214` means the same thing on every reload.

Details that are there because they are how the job works:

- **Road distance, not great-circle.** Bhiwandi → Bengaluru is 985 km by road
  against roughly 840 as the crow flies, and freight is billed on the road.
- **E-way bill validity follows CGST Rule 138** — one day per 200 km or part
  thereof, expiring at *IST midnight* of the following day. A bill raised at
  23:40 gets twenty minutes out of its first day. That is why several trips
  show an expiry at the same instant: they all died at the same midnight.
- **SXL and MXL are different trucks.** Same 32-foot deck, 9 MT against 15 MT
  rated payload. Confusing them is how a dispatch goes wrong.
- **Bulky cargo cubes out before it weighs out**, so it runs under rating.
- **Detention is measured against contracted free time** — 8 hours at origin,
  6 at destination.

### Status is derived, not assigned

A trip is `at_risk` because something high or critical is open against it right
now — never because the generator labelled it that way. Exceptions are computed
from the trip's own numbers, so every detail line agrees with the data behind
it: a delay of 4h 20m reads 4h 20m, and the e-way countdown matches the bill on
the documents tab.

That constraint caught a real modelling error. An early version raised e-way
bills up to 30 hours before dispatch, which put **EX-07 on 21.9% of active
trips** — no plant dispatches on validity it has already burnt. Moving bill
generation next to dispatch dropped it to 4.2% and brought the board to
`in_transit` 63.2% · `delivered` 21.9% · `at_risk` 8.1% · `planned` 6.8%.

## Tests

```bash
npm test
```

23 tests covering determinism, the 150 ms generation budget, Rule 138 validity
including the midnight edge, referential integrity, payload limits, milestone
ordering, the derived-status invariant, and a sweep asserting no placeholder
content anywhere in the dataset.

## Status

Phases 0–1 complete. The control tower now runs on the generated fleet: real
KPIs, a real severity-ordered exception queue, and a plain trip table. The map
is still a phase-3 placeholder, and the table gets virtualisation, filtering and
saved views in phase 4.

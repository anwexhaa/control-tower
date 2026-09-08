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
  map/                   projection, quadtree, routes, canvas scene, NetworkMap
  data/                  india.simplified.json (committed boundaries)
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

## The simulation

The fleet moves. A clock decoupled from wall time runs at pause · 1× · 60× ·
600×, and every derived figure follows it — position, speed, ETA, exceptions,
KPIs.

### Nothing is accumulated, so nothing drifts

Position is not stepped forward each tick. It is the **integral of an
hour-of-day road-speed profile** between dispatch and now, evaluated in closed
form. Trucks crawl out of cities, run well mid-morning, lose the early
afternoon, and mostly stop overnight — at 600× you watch the fleet stall around
02:00 IST and surge again after dawn.

Because it is a difference of two integrals rather than a running total,
stepping in ten-second slices and jumping straight to the answer agree to
twelve decimal places. Pause, scrub and 600× playback all land on the same
board. That property is a test, not a claim.

### Exceptions emerge from movement

Trips carry a *plan*, not a status: a pace factor, scheduled incidents, GPS
dropout windows, reefer excursions. The engine derives everything else.

The ETA projection deliberately only knows about incidents that have **already
started** — the same information a control tower has. So an ETA does not slip
in advance of a truck stopping; it slips the moment the truck stops. That one
constraint is what makes the board feel like an operations screen rather than a
replay.

All ten rules are pure `(trip, state, instant) => hit | null`. The engine owns
raising, ageing, clearing and acknowledgement, so a rule cannot depend on how
often it is called. An exception raises once and then ages in place — `Halted 2h
10m` becomes `Halted 3h 40m` on the same row — and auto-clears when the
condition ends, with a ten-minute dwell floor so nothing sitting on a threshold
flaps.

### Measured, not assumed

| | median | max |
| --- | --- | --- |
| `engine.step` (1,200 trips) | 1.72 ms | 7.13 ms |
| `computeKpis` | 0.09 ms | 1.12 ms |
| `buildQueue` | 0.19 ms | 1.36 ms |
| **whole tick** | **2.05 ms** | 9.61 ms |

Zero long tasks over 50 ms in a production build. Dev mode shows ~150 ms spikes
per tick — that is StrictMode double-rendering the table, not the simulation.

**The planned Web Worker was dropped on this evidence.** The spec called for
moving the tick off the main thread above ~800 trips; measurement says the tick
costs 2 ms per second, so a worker would buy nothing and cost a serialisation
boundary. The engine is still a plain class with no DOM dependencies, so the
seam is there if the fleet ever grows enough to need it.

## The map

No Mapbox, no Leaflet, no tile server. The projection, the renderer and the
hit-testing are all written here, because dropping in a map library is a
five-minute task and writing the projection is a different conversation.

### Boundary data

Real Indian state geometry, reduced offline by `scripts/simplify.mjs`:

| | |
| --- | --- |
| Source | 36 states, 804 rings, **526,189 points** |
| Douglas–Peucker | tolerance 0.024° (≈2.7 km) |
| Committed | 33 states, 41 rings, **6,296 points** |
| Size | **46.6 KB raw, 18.9 KB gzipped** |

Encoded as delta integers quantised to 0.001° (~110 m), so the file is mostly
one- and two-digit numbers. At the default fit the tolerance is about 0.6 of a
screen pixel — invisible until you zoom well in. Chandigarh, Lakshadweep and
Puducherry fall below the ring-area threshold; none carries a freight node.

### Two layers, one transform

Geography is a **static SVG layer that never re-renders** — pan and zoom are a
single `transform` attribute on one `<g>`, so the browser composites it rather
than rebuilding 6,296 points of path data every frame. The fleet, corridors and
nodes go on a **canvas above it**, because 1,200 markers as DOM nodes will not
hold 60 fps, and because a node dot should stay 4 px whether you are looking at
the whole country or one district.

Markers are accumulated into **one `Path2D` per colour and filled four times a
frame** — no per-marker `save`/`restore`, no per-marker transform. Rotation is
done by computing the triangle's vertices directly from `sin`/`cos`.

### The quadtree is indexed in world space, not screen space

This is the decision worth pointing at. The obvious build indexes screen
positions — and then every pan and every zoom invalidates the whole tree, at 60
Hz. Indexing in **world** coordinates and scaling the query radius by `1/k`
instead means the tree is rebuilt only when the fleet actually moves, once a
second.

### Routes are great-circle

Corridors are interpolated along the great circle through their waypoints, not
drawn as straight Mercator chords. Over 1,600 km a chord visibly cuts the
corner, and a control tower that puts a Ludhiana–Mumbai truck in the wrong
state is worse than no map.

### What is measured, and what is not

- **Projection round-trip**: every one of the 70 freight nodes returns to
  within 0.01° through project → screen → unproject. Asserted in tests.
- **Quadtree**: agrees with a brute-force scan over 200 random queries against
  1,200 points, and resolves in well under 1 ms per query. Asserted in tests.
- **Route geometry**: no drawn corridor exceeds the road distance it
  represents, and sampling 2,000 points along one never goes backwards.
- **Sustained 60 fps panning is not machine-verified here.** The automated
  browser harness reports `visibilityState: hidden`, which throttles timers and
  `requestAnimationFrame` and suppresses the redraw, so any frame number it
  produced would be fiction. The map carries a live draw-cost readout in its
  bottom-right corner instead — open it and pan to see the real number.

## Tests

```bash
npm test
```

103 tests. Highlights:

- **Every rule** has hit and miss cases against a hand-built fixture — no
  engine, no clock, no generator.
- **Drift**: stepping in ten-second slices equals one big jump to 12 decimals.
- **Path independence**: a finely-stepped engine and a single-jump engine reach
  identical progress, ETA, status and arrival.
- **Raise once**: a standing condition ages in place instead of re-firing.
- **Dwell floor**: an exception cannot flap open and shut on a threshold.
- **No unbounded growth**: event log and per-trip closed-exception history are
  both capped, verified over ten simulated days of flapping telemetry, while an
  exception that stays open the whole run still survives the cap.
- Rule 138 validity including the IST-midnight edge, referential integrity,
  payload limits, and a sweep for placeholder content.

## Status

Phases 0–3 complete. The board is live and mapped: trucks move along real
corridors, ETAs re-project, exceptions raise and clear on their own, and the
fleet is drawn on a hand-rolled map with hover, selection, clustering and layer
toggles. The table gets virtualisation, filtering and saved views in phase 4.

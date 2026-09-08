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
    track/               control tower  (phases 3–4)
    trip/                detail drawer  (phase 5)
    pulse/               analytics      (phase 6)
    system/              living design-system reference at /system
  charts/                shared scale module
  a11y/                  live region, shortcut sheet, map list view
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

## The board

### One filter, four panes

The map, the exception queue, the trip table and the KPI strip cannot disagree
about what the user is looking at, because there is nothing for them to
disagree with — they all read one `TripFilter` and call the same `matchTrip`.

Every dimension composes: lane AND severity AND transporter AND exception code
AND free text, simultaneously. Clicking the **At risk** tile narrows all four to
144 trips; adding a transporter from the command palette takes it to 88, and the
queue drops from 474 open exceptions to 33 alongside it.

Each active dimension is a removable chip, so there is never a filter in force
that the user cannot see. The failure mode with faceted filtering is always
"why is this table empty", and the answer should be on screen.

One detail worth the extra line of code: `codes: ["EX-03"]` combined with
`severities: ["critical"]` selects **nothing**, because the match requires a
*single* exception to satisfy both. Plenty of trips carry an EX-03 and a
separate critical; matching those would be wrong, and it is a test.

### Virtualisation

1,200 rows of eleven cells is roughly 13,000 DOM nodes, which React mounts
happily and then scrolls like treacle. Only the visible window is mounted —
**23 rows at 1,200 total** — with two spacer rows keeping the scrollbar honest.
Row height is read from the `--row-h` density token rather than hardcoded, so
the compact toggle moves the window with it.

### Sparklines are real history

The KPI strip shows a trailing 24 simulated hours and a delta against the same
figure a day ago. Rather than filling in over the first few minutes, a
throwaway engine replays the day before the epoch at startup (~45 ms) and the
KPIs are captured hourly. It is discarded, so none of its exception state
leaks into the live board.

### Triage

Acknowledge, snooze (2/6/12 h) and resolve-with-reason are wired to the engine.
Ageing is shown as colour as well as a number, and the threshold scales with
severity — a critical that has sat for forty minutes is a worse sign than a low
that has sat all day.

Resolving by hand records `actioned` rather than `cleared`. If the underlying
condition is still true the rule raises it again on the next tick, which is the
honest behaviour: resolving is a statement about the response, not about the road.

### Saved views

Filter, sort and column visibility persist to `localStorage` and survive a
reload, as does the last-used board state and the height of the docked table.

## The trip drawer

`/track/TRP-88002` opens the detail cold — selection lives in the URL, so a
controller can paste a trip at somebody rather than describing it.

**Milestones are planned against actual.** The plan is fixed at generation; the
actual chain is anchored on when the truck really arrived. A trip running 2h 26m
behind shows that variance on unloading, POD *and* invoicing — a truck that
lands late does not magically invoice on time, and that propagation is the point
of the view.

**The ping trail does not lie.** Stretches where telemetry was dark are drawn as
their own dashed segments rather than being joined into the solid line. A
control tower that quietly interpolates across a coverage hole is asserting a
position nobody reported.

**The e-way countdown runs on the simulation clock**, so pausing freezes it and
600× burns it down in front of you. It shows validity remaining beside distance
still to run, because neither number means much alone.

**Reefer traces are deterministic** — a slow wobble inside the contracted band
plus whatever the scheduled excursions add, ramped in and out rather than
stepped, which is how a box actually warms. The band is shaded and a breach
recolours the line.

### Optimistic actions, with real rollback

Notes, agreed ETAs and hand-raised exceptions apply immediately, then wait on a
simulated round trip and undo themselves if it fails. Verified in the browser:
the fourth note appeared 150 ms after the click and reverted once the round trip
came back — 4 notes on screen, then 3.

The failure is deterministic (every fifth outward-facing action) because a demo
that fails at random is impossible to talk through. One action fails for a
*reason* instead: calling the driver fails when the vehicle is in a coverage
hole, which is exactly the situation EX-03 exists to surface.

A hand-raised exception is invisible to its rule — the engine will neither
refresh nor clear it. Somebody put it there, so somebody takes it away.

## Pulse

The review a logistics head runs, computed from the same board the controllers
are working. Every figure recomputes on each tick — **2.6 ms for the whole
set** — so the two screens cannot drift apart.

### Charts, hand-drawn, with the rules enforced

**No dual axis, anywhere.** The Pareto is where that mistake usually lives:
counts on the left, cumulative percent on the right, and two y-scales let you
imply any crossing point you like. Both series here are percentages on one
0–100 axis, which says the same thing and cannot mislead. *4 of 8 codes account
for 80%* — EX-05 detention leads at 161, then EX-01 ETA slip at 122.

**The heat table is diverging, not sequential.** On-time percentage has a
meaningful midpoint — the 90% the network is held to — so the ramp runs from
the critical hue through a neutral *at target* to the healthy one. Volume is
carried in a separate column, so colour never has to mean two things at once.
A window with no delivery is drawn as an empty dashed cell rather than shaded
as 0%: nothing delivered is not the same as everything delivered late.

**Cost per BTKM carries the bar** because it is the one figure that compares a
125 km run against a 2,180 km one. Cost per MT and the detention estimate sit
beside it as numbers — different scales, so they are not given bars of their own.

**The palette was validated, not eyeballed.** The Pareto's two series initially
used the accent against muted ink, which separates by only **ΔE 12.9** for
normal vision in dark mode — below the 15 floor. Moving the cumulative line to
full ink took it to **30.6 dark / 39.1 light**, with CVD separation of 28.7 and
36.2.

### One deviation from the plan, and why

The plan said the lane heat table should show **weeks**. The simulated board
only carries about thirty hours of completed trips, so weekly columns would be
one column of data and six of nothing. It shows **four-hour blocks over the
last day** instead — what the data can actually support, and the window a shift
lead works in.

The plan also said these aggregates should derive from the event log. They do
not, and should not: the log is a capped tail of the last 2,000 events, so it is
the wrong source for a fleet-wide total. Live state is both complete and cheaper.

## Accessibility and performance

Both are measured rather than asserted, and the numbers live in
[`PERFORMANCE.md`](PERFORMANCE.md).

| | Budget | Measured |
| --- | --- | --- |
| Cold load | under 2 s | **353 ms** |
| JS, gzipped | under 220 KB | **129.1 KB** |
| Long tasks over 50 ms at 60× | none | **0 in 25 s** |
| axe-core violations | none | **0**, three pages, both themes |

Getting to zero long tasks took two changes, and neither was the simulation —
that costs 2 ms a second. The queue was re-rendering eighty rows of triage
controls once a second because each row's age label changes; the controls are
now memoised behind a ref-stable callback, and the queue renders its top thirty.
A triage queue is worked from the top anyway.

The keyboard work is real, not decorative: the virtualised table uses a roving
tabindex so Tab steps past it rather than through 1,200 stops, arrows move the
cursor, and because a row may not be mounted when the cursor reaches it, moving
scrolls first and focuses after the render. `?` opens the shortcut sheet.

The map has a **list view** reachable by everyone, rather than ARIA bolted onto
a canvas of 1,100 rotated triangles. New criticals are announced through a
polite live region — polite because a critical is urgent for the fleet, not
urgent enough to interrupt a sentence someone is reading.

### One trap worth repeating

axe first reported 23 contrast failures in dark mode that a separate audit
called clean. It was reading the *light* theme's ink token against a dark
ground: the rail links carry `transition-colors`, and a tab that is not
painting never advances a CSS transition, so `getComputedStyle` returns a colour
frozen mid-switch. **Any automated contrast audit against a UI with colour
transitions has to freeze them first**, or it reports the theme you left.

## Deploying

```bash
npm run build     # typecheck, then build to dist/
npm run preview   # serve the production build locally
```

`vercel.json` sets the framework, the build command and — the part that is not
automatic — an **SPA rewrite**. Without it `/track/TRP-88002` works when you
navigate to it in the app but 404s on a hard refresh or a pasted link, which
would defeat the point of putting the trip id in the URL.

## Tests

```bash
npm test
```

170 tests. Highlights:

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

Phases 0–7 complete. The control tower is operable and drills down: one
composable filter drives the map, queue, table and KPI strip together; the table
is virtualised over the full fleet; Cmd-K jumps to any trip, transporter,
corridor, exception code or saved view; and every trip opens a detail drawer
with its milestone variance, ping trail, telemetry, paperwork and controller
actions. Pulse turns the same live state into a carrier scorecard, a corridor
heat table, a delay Pareto and cost per BTKM.

All eight phases are complete.

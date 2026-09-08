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

## Status

Phase 0 complete — foundation, tokens, primitives, app shell, routing. The Track
and Pulse screens currently render their final layout geometry with each region
labelled by the phase that fills it.

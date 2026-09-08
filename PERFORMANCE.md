# Performance and accessibility budget

Measured, not assumed. Every figure below came from the **production build**
served by `vite preview`, because dev-mode numbers are dominated by StrictMode
double-rendering and tell you nothing about what ships.

Reproduce with:

```bash
npm run build && npm run preview
```

then open `/track` and watch the readouts in the panel headers — the
simulation step time sits in the *Live network* header, and the canvas scene
draw sits in the map's bottom-right corner.

---

## The budget

| | Budget | Measured | |
| --- | --- | --- | --- |
| Cold load (`loadEventEnd`) | under 2 s | **353 ms** | pass |
| JS transferred, gzipped | under 220 KB | **129.1 KB** | pass |
| Long tasks over 50 ms during a 60× run | none | **0 in 25 s** | pass |
| axe-core violations | none | **0** across `/track`, `/pulse`, `/system`, both themes | pass |

Bundle, exact bytes from the build output:

| Asset | Raw | Gzipped |
| --- | --- | --- |
| `index.js` | 412,964 | **131,461** |
| `index.css` | 34,784 | 7,763 |
| `index.html` | 1,515 | 753 |

## Simulation cost

Median of 15 steps against the full 1,200-trip fleet, measured in Node:

| | Median | Max |
| --- | --- | --- |
| `engine.step` | 1.72 ms | 7.13 ms |
| `computeKpis` | 0.09 ms | 1.12 ms |
| `buildQueue` | 0.19 ms | 1.36 ms |
| **whole tick** | **2.05 ms** | 9.61 ms |

Pulse recomputes its whole aggregate set — scorecard, heat table, Pareto, cost
— in **2.6 ms**.

Both budget tests take the **median of several passes**, not a single
wall-clock sample. An earlier version asserted one reading under 8 ms and
failed roughly one run in three at 8–10 ms, which is how a suite teaches people
to ignore it.

## What actually cost the frame budget

The first honest measurement showed **5 long tasks of 53–61 ms in 12 seconds**
— the budget was not met. The simulation was not the problem: it costs 2 ms a
second.

Narrowing the board to a filter that left 32 list items dropped it to **zero**
long tasks, which pointed straight at render volume rather than computation.
Two changes fixed it:

1. **The triage controls are memoised.** Each queue row carried a tooltip, a
   button, a four-option `<select>` and another button — roughly ten components
   — and all of them re-rendered once a second because the row's age label
   changes. None of those controls depend on the clock, so they were split into
   a `memo`'d component. Its callback is held in a ref so it has no
   dependencies and its identity actually holds; an inline arrow would have
   made the memo useless.
2. **The queue renders its top 30.** As much a product decision as a
   performance one: a triage queue is worked from the top, nobody scrolls four
   hundred exceptions, and the filter is how you reach the rest.

Result: **zero long tasks over 25 seconds at 60×**.

## Accessibility

`axe-core` 4.10.2, run against the live DOM on `/track`, `/pulse` and
`/system`, in both themes. **Zero violations.**

Two real defects it caught:

- **A focusable `role="separator"` is a widget.** The table's resize handle had
  `tabindex="0"` but no `aria-valuenow`, which axe rates critical — a screen
  reader had no idea what the arrow keys were changing. It now reports its
  value, bounds and a human-readable `aria-valuetext`.
- **Two unnamed `<select>`s** on the design-system page, rendered without a
  label to demonstrate the component. Given accessible names.

### A measurement trap worth knowing

axe first reported **23 contrast violations in dark mode** that a separate
audit said were clean. It was reading `#565f7a` — the *light* theme's ink token
— against a dark background.

The cause was not the palette. The rail links carry `transition-colors`, and a
browser tab that is not painting never advances a CSS transition, so
`getComputedStyle` returns a colour frozen mid-switch. Injecting
`* { transition: none !important }` before the run resolved the same element to
`#8b96b0`, the correct dark token, and the violations disappeared.

**Any automated contrast audit against a UI with colour transitions must freeze
them first**, or it will report the theme you switched away from.

### Keyboard

Verified in the browser, not asserted:

- The virtualised table uses a **roving tabindex** — 23 rows mounted, exactly
  one in the tab order, so Tab moves past the table rather than through 1,200
  stops. Arrow keys move the cursor (verified: index 0 → 5 after five
  `ArrowDown`s), with Home, End, PageUp, PageDown, Enter to open, and
  type-ahead over LR and registration numbers.
- Because a row may not be mounted when the cursor moves to it, moving scrolls
  first and focuses after the render rather than in the key handler.
- The exception queue's rows are list items with a real button for selection,
  not clickable `div`s. Making the whole row a control would have nested the
  acknowledge, snooze and resolve buttons inside another button.
- `?` opens the shortcut sheet, which is also the honest record of what is
  bound — if a binding is not on that list, it does not exist.

### Screen readers and motion

- The map has a **list view**, reachable by everyone rather than hidden behind
  a screen-reader-only class. A canvas of 1,100 rotated triangles is not
  readable by anything but an eye, so the same data has a real list rendering
  instead of ARIA bolted onto a canvas.
- New critical exceptions are announced through a **polite** live region.
  Polite, not assertive: a critical is urgent for the fleet, not urgent enough
  to cut across a sentence someone is mid-way through reading. Only arrivals
  are announced — repeating the standing count every tick would make the region
  useless.
- `prefers-reduced-motion` stops the pulsing halo on fresh criticals and
  flattens transitions. It never stops the simulation: someone who dislikes
  motion still needs the trucks to move.

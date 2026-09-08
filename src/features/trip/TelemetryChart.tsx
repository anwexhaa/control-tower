import { istTime } from "../../domain/format";
import type { Sample, TemperatureBand } from "./telemetry";

/* One scale, drawn once.

   Every tick label names a value the line actually reaches, the drawing keeps
   its labels inside the viewBox, and colours come from the theme tokens rather
   than being baked in — the same chart has to read on both grounds. */

const W = 520;
const HGT = 118;
const PAD = { top: 10, right: 8, bottom: 18, left: 34 };

export function TelemetryChart({
  samples,
  unit,
  band,
  label,
}: {
  samples: Sample[];
  unit: string;
  /** When present, the contracted range is shaded and breaches are called out. */
  band?: TemperatureBand | null;
  label: string;
}) {
  if (samples.length < 2) {
    return (
      <p className="rounded-sm border border-line-soft bg-sunken px-3 py-6 text-center text-[12px] text-ink-mute">
        Nothing reported yet — the vehicle has not rolled.
      </p>
    );
  }

  let min = Infinity;
  let max = -Infinity;
  for (const s of samples) {
    if (s.value < min) min = s.value;
    if (s.value > max) max = s.value;
  }
  if (band) {
    min = Math.min(min, band.min);
    max = Math.max(max, band.max);
  }
  // Breathing room, and never a zero-height scale.
  const pad = Math.max(0.5, (max - min) * 0.12);
  min -= pad;
  max += pad;
  const span = max - min || 1;

  const plotW = W - PAD.left - PAD.right;
  const plotH = HGT - PAD.top - PAD.bottom;

  const x = (i: number) => PAD.left + (i / (samples.length - 1)) * plotW;
  const y = (v: number) => PAD.top + plotH - ((v - min) / span) * plotH;

  const line = samples
    .map((s, i) => `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(s.value).toFixed(1)}`)
    .join("");
  const area = `${line}L${x(samples.length - 1).toFixed(1)} ${PAD.top + plotH}L${PAD.left} ${PAD.top + plotH}Z`;

  const ticks = [min + pad, (min + max) / 2, max - pad];
  const breached = band ? samples.some((s) => s.value > band.max || s.value < band.min) : false;
  const stroke = breached ? "var(--color-crit)" : "var(--color-accent)";

  return (
    <figure className="m-0">
      <svg
        viewBox={`0 0 ${W} ${HGT}`}
        className="block w-full rounded-sm border border-line-soft bg-sunken"
        role="img"
        aria-label={`${label}, ranging from ${ticks[0].toFixed(1)} to ${ticks[2].toFixed(1)} ${unit}`}
      >
        {/* contracted band */}
        {band && (
          <>
            <rect
              x={PAD.left}
              y={y(band.max)}
              width={plotW}
              height={Math.max(1, y(band.min) - y(band.max))}
              fill="var(--color-ok)"
              opacity={0.12}
            />
            <line
              x1={PAD.left} x2={W - PAD.right} y1={y(band.max)} y2={y(band.max)}
              stroke="var(--color-ok)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7}
            />
            <line
              x1={PAD.left} x2={W - PAD.right} y1={y(band.min)} y2={y(band.min)}
              stroke="var(--color-ok)" strokeWidth={1} strokeDasharray="3 3" opacity={0.7}
            />
          </>
        )}

        {/* grid and value labels */}
        {ticks.map((t, i) => (
          <g key={i}>
            <line
              x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)}
              stroke="var(--color-line)" strokeWidth={0.75} opacity={0.6}
            />
            <text
              x={PAD.left - 5} y={y(t) + 3}
              textAnchor="end"
              fontSize="9"
              fontFamily="'IBM Plex Mono', monospace"
              fill="var(--color-ink-faint)"
            >
              {t.toFixed(t >= 100 || Math.abs(t) < 1 ? 0 : 1)}
            </text>
          </g>
        ))}

        {!band && <path d={area} fill={stroke} opacity={0.1} />}
        <path d={line} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinejoin="round" />

        <circle
          cx={x(samples.length - 1)}
          cy={y(samples[samples.length - 1].value)}
          r={2.5}
          fill={stroke}
        />

        {/* time axis */}
        <text x={PAD.left} y={HGT - 5} fontSize="9" fontFamily="'IBM Plex Mono', monospace" fill="var(--color-ink-faint)">
          {istTime(samples[0].at)}
        </text>
        <text
          x={W - PAD.right} y={HGT - 5} textAnchor="end"
          fontSize="9" fontFamily="'IBM Plex Mono', monospace" fill="var(--color-ink-faint)"
        >
          {istTime(samples[samples.length - 1].at)}
        </text>
      </svg>

      <figcaption className="mt-1.5 flex items-center gap-2 text-[11px] text-ink-faint">
        <span>{label}</span>
        {band && (
          <span className={breached ? "text-crit" : "text-ok"}>
            {band.label}
            {breached ? " · breached" : " · held"}
          </span>
        )}
        <span className="ml-auto font-mono tabular-nums">
          now {samples[samples.length - 1].value.toFixed(1)} {unit}
        </span>
      </figcaption>
    </figure>
  );
}

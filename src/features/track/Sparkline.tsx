/* A 24-hour trace under each KPI.

   Deliberately spare: an area fill for weight, a line for the shape, and an
   emphasised endpoint so the eye lands on "now" rather than wandering the
   series. No axes — the number above it is the value, the line is only the
   direction of travel. */

export function Sparkline({
  values,
  tone = "accent",
  width = 96,
  height = 22,
}: {
  values: readonly number[];
  tone?: "accent" | "ok" | "warn" | "crit";
  width?: number;
  height?: number;
}) {
  if (values.length < 2) {
    return <div style={{ width, height }} aria-hidden="true" />;
  }

  let min = Infinity;
  let max = -Infinity;
  for (const v of values) {
    if (v < min) min = v;
    if (v > max) max = v;
  }
  // A flat series should read flat, not as a full-scale zigzag.
  const span = max - min < 1e-9 ? 1 : max - min;
  const pad = 2;
  const usable = height - pad * 2;

  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => pad + usable - ((v - min) / span) * usable;

  let line = "";
  for (let i = 0; i < values.length; i++) {
    line += `${i === 0 ? "M" : "L"}${x(i).toFixed(1)} ${y(values[i]).toFixed(1)}`;
  }
  const area = `${line}L${width} ${height}L0 ${height}Z`;

  const lastX = x(values.length - 1);
  const lastY = y(values[values.length - 1]);
  const stroke = `var(--color-${tone})`;

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="block overflow-visible"
      aria-hidden="true"
    >
      <path d={area} fill={stroke} opacity={0.12} />
      <path d={line} fill="none" stroke={stroke} strokeWidth={1.25} strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r={2} fill={stroke} />
    </svg>
  );
}

"use client";

// Taste path: why Qloo picked a swap. The audience's taste anchors on the left,
// the original and the replacement on the right; each anchor's line to the
// replacement is as thick as its share in Qloo's explainability for that pick.

const W = 340;
const ROW = 34;

export function TastePath({
  drivers,
  original,
  replacement,
}: {
  drivers: { name: string; share: number }[];
  original: { name: string; percentile: number | null };
  replacement: { name: string; percentile: number | null };
}) {
  if (!drivers.length) return null;
  const H = Math.max(2, drivers.length) * ROW + 12;
  const ax = 92;
  const rx = W - 108;
  const ay = (i: number) => 18 + i * ROW + (H - 12 - drivers.length * ROW) / 2;
  const newY = H / 2 - 16;
  const oldY = H / 2 + 22;
  const clip = (s: string, n = 15) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

  return (
    <figure className="flex flex-col gap-1">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={`Why ${replacement.name}: ${drivers.map((d) => `${d.name} ${Math.round(d.share * 100)}%`).join(", ")}`}>
        {drivers.map((d, i) => (
          <g key={d.name}>
            <path
              d={`M${ax + 6},${ay(i)} C${(ax + rx) / 2},${ay(i)} ${(ax + rx) / 2},${newY} ${rx - 8},${newY}`}
              className="taste-flow stroke-accent"
              fill="none"
              strokeWidth={1.5 + d.share * 7}
              strokeOpacity={0.35 + d.share * 0.5}
            />
            <text x={(ax + rx) / 2} y={(ay(i) + newY) / 2 - 4} textAnchor="middle" className="fill-muted font-mono" fontSize={9}>
              {Math.round(d.share * 100)}%
            </text>
            <circle cx={ax} cy={ay(i)} r={5} className="fill-accent" />
            <text x={ax - 10} y={ay(i) + 4} textAnchor="end" className="fill-ink" fontSize={11}>
              {clip(d.name, 14)}
            </text>
          </g>
        ))}
        <path d={`M${ax + 6},${H / 2} C${(ax + rx) / 2},${H / 2} ${(ax + rx) / 2},${oldY} ${rx - 8},${oldY}`} className="stroke-rule" fill="none" strokeWidth={1.2} strokeDasharray="3 4" />
        <circle cx={rx} cy={newY} r={7} className="fill-lands" />
        <text x={rx + 12} y={newY + 4} className="fill-ink font-medium" fontSize={11}>
          {clip(replacement.name)}
        </text>
        <text x={rx + 12} y={newY + 16} className="fill-lands font-mono" fontSize={9}>
          {replacement.percentile === null ? "" : `p${replacement.percentile}`}
        </text>
        <circle cx={rx} cy={oldY} r={5} className="fill-sheet stroke-misses" strokeWidth={1.5} />
        <text x={rx + 12} y={oldY + 4} className="fill-muted line-through" fontSize={11}>
          {clip(original.name)}
        </text>
        <text x={rx + 12} y={oldY + 16} className="fill-misses font-mono" fontSize={9}>
          {original.percentile === null ? "" : `p${original.percentile}`}
        </text>
      </svg>
      <figcaption className="text-[11px] text-muted">
        Why Qloo picked it: line width is each taste anchor&apos;s share of {replacement.name}&apos;s affinity for this audience.
      </figcaption>
    </figure>
  );
}

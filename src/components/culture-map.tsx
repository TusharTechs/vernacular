"use client";

import { useMemo, useRef, useState } from "react";
import type { Ring } from "@/lib/qloo/geo";
import type { AudienceSpec, ScoredReference, Swap } from "@/lib/vernacular/types";

interface Hood {
  id: string;
  name: string;
  rings: Ring[];
}
interface RefLayer {
  name: string;
  entityId: string;
  role: "original" | "swap";
  replaces?: string;
  ranked: string[];
  overlap: number;
}
interface MapData {
  city: string;
  hoods: Hood[];
  audience: { ranked: string[] };
  references: RefLayer[];
  qlooCalls: number;
}

// Must match MAP_TOP in lib/vernacular/map.ts.
const TOP = { audience: 10, reference: 20 };
const MIN_LOCAL_DATA = 5;
const CITIES = ["Chicago", "Los Angeles", "New York", "Miami", "Houston", "Atlanta"];
const W = 600;

function project(hoods: Hood[]) {
  const pts = hoods.flatMap((h) => h.rings.flat());
  const lons = pts.map((p) => p[0]);
  const lats = pts.map((p) => p[1]);
  const [minLon, maxLon, minLat, maxLat] = [Math.min(...lons), Math.max(...lons), Math.min(...lats), Math.max(...lats)];
  const kx = Math.cos((((minLat + maxLat) / 2) * Math.PI) / 180);
  const scale = W / ((maxLon - minLon) * kx || 1);
  const H = Math.round((maxLat - minLat) * scale) || W;
  const xy = ([lon, lat]: [number, number]) => [(lon - minLon) * kx * scale, (maxLat - lat) * scale] as const;
  const path = (rings: Ring[]) => rings.map((r) => `M${r.map((p) => xy(p).map((v) => v.toFixed(1)).join(",")).join("L")}Z`).join("");
  const centre = (rings: Ring[]) => {
    const all = rings.flat();
    return xy([all.reduce((s, p) => s + p[0], 0) / all.length, all.reduce((s, p) => s + p[1], 0) / all.length]);
  };
  return { H, path, centre };
}

/** Drop labels that would overlap one already placed (strongest first). */
function placeLabels<T extends { name: string; at: readonly [number, number] }>(items: T[], size: number): T[] {
  const placed: T[] = [];
  for (const it of items) {
    const w = it.name.length * size * 0.55;
    const clash = placed.some((p) => Math.abs(p.at[1] - it.at[1]) < size * 1.1 && Math.abs(p.at[0] - it.at[0]) < (w + p.name.length * size * 0.55) / 2);
    if (!clash) placed.push(it);
  }
  return placed;
}

function Meter({ value, of }: { value: number; of: number }) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {Array.from({ length: of }, (_, i) => (
        <span key={i} className={`h-2 w-2 rounded-sm ${i < value ? "bg-lands" : "bg-rule"}`} />
      ))}
    </span>
  );
}

export function CultureMap({ audience, references, swaps }: { audience: AudienceSpec; references: ScoredReference[]; swaps: Swap[] }) {
  const [city, setCity] = useState(audience.location || "Chicago");
  const [data, setData] = useState<MapData | null>(null);
  const [layer, setLayer] = useState<string>("audience");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refs = useMemo(() => {
    const spanOf = (id: string) => references.find((r) => r.id === id)?.entity?.name ?? id;
    return [
      ...references.filter((r) => r.entity).map((r) => ({ name: r.entity!.name, entityId: r.entity!.id, role: "original" as const })),
      ...swaps.map((s) => ({ name: s.replacement.name, entityId: s.replacement.id, role: "swap" as const, replaces: spanOf(s.referenceId) })),
    ];
  }, [references, swaps]);

  const run = async (forCity = city) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/map", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ city: forCity, audience, references: refs }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't build the map.");
      setData(body);
      setLayer("audience");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't build the map.");
    } finally {
      setBusy(false);
    }
  };

  const [hover, setHover] = useState<string | null>(null);
  const [pointer, setPointer] = useState<{ x: number; y: number; w: number } | null>(null);
  const [focusId, setFocusId] = useState<string | null>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const view = useMemo(() => (data ? project(data.hoods) : null), [data]);
  const audTop = new Set(data?.audience.ranked.slice(0, TOP.audience));
  const selected = data?.references.find((r) => r.entityId === layer) ?? null;
  const refTop = new Set(selected?.ranked.slice(0, TOP.reference));
  const audRank = new Map(data?.audience.ranked.map((id, i) => [id, i]));
  const refRank = new Map(selected?.ranked.map((id, i) => [id, i]));
  const nameOf = (id: string) => data?.hoods.find((h) => h.id === id)?.name ?? "";

  // Audience layer: a graded scale by rank. Reference layer: where the audience and the reference's fans overlap.
  const fillFor = (id: string): { color: string; opacity: number } => {
    if (selected) {
      if (audTop.has(id) && refTop.has(id)) return { color: "var(--lands)", opacity: 0.95 };
      if (audTop.has(id)) return { color: "var(--accent)", opacity: 0.4 };
      if (refTop.has(id)) return { color: "var(--mixed)", opacity: 0.45 };
      return { color: "var(--rule)", opacity: 0.6 };
    }
    const r = audRank.get(id);
    if (r === undefined) return { color: "var(--rule)", opacity: 0.6 };
    if (r < TOP.audience) return { color: "var(--accent)", opacity: 1 - r * 0.03 };
    if (r < 30) return { color: "var(--accent)", opacity: 0.55 - (r - TOP.audience) * 0.015 };
    return { color: "var(--accent)", opacity: 0.12 };
  };
  const focusHood = focusId ? data?.hoods.find((h) => h.id === focusId) : undefined;
  const labelSize = view ? Math.max(14, (view.H > W ? view.H : W) / 40) : 14;
  const summary = !data
    ? ""
    : selected
      ? selected.ranked.length < MIN_LOCAL_DATA
        ? `Qloo has too little local data for ${selected.name} in ${data.city}.`
        : `${selected.name} fans live in ${selected.overlap} of your audience's ${TOP.audience} strongest neighbourhoods${
            selected.overlap ? `, including ${data.audience.ranked.slice(0, TOP.audience).filter((id) => refTop.has(id)).slice(0, 2).map(nameOf).join(" and ")}` : ""
          }.`
      : `${audience.label} over-index most in ${data.audience.ranked.slice(0, 3).map(nameOf).join(", ")}.`;
  const labelled = data
    ? selected
      ? data.audience.ranked.slice(0, TOP.audience).filter((id) => refTop.has(id)).slice(0, 6)
      : data.audience.ranked.slice(0, 5)
    : [];

  return (
    <section className="@container flex flex-col gap-4 rounded-xl border border-rule bg-sheet p-6" aria-label="Culture map">
      <div className="flex flex-col gap-1">
        <h2 className="text-sm font-semibold">Where it lands</h2>
        <p className="text-sm text-muted">
          Pick a city to see which neighbourhoods your audience over-indexes in on Qloo, and whether each reference&apos;s fans live there too. Useful
          for out-of-home, local and geo-targeted runs.
        </p>
      </div>

      <form
        data-tour="map"
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run();
        }}
      >
        <input
          aria-label="City"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          maxLength={60}
          className="w-44 rounded-md border border-rule bg-sheet px-3 py-1.5 text-sm outline-none focus:border-accent"
        />
        <button type="submit" disabled={busy || !city.trim()} className="rounded-md bg-ink px-3 py-1.5 text-sm text-sheet disabled:opacity-40">
          {busy ? "Mapping…" : "Map it"}
        </button>
        <span className="mx-1 text-xs text-muted">or</span>
        {CITIES.map((c) => (
          <button
            key={c}
            type="button"
            disabled={busy}
            onClick={() => {
              setCity(c);
              run(c);
            }}
            className={`rounded-full border px-2.5 py-0.5 text-xs ${data?.city === c ? "border-ink text-ink" : "border-rule text-muted hover:border-accent hover:text-ink"}`}
          >
            {c}
          </button>
        ))}
      </form>
      {busy && (
        <p className="font-mono text-xs text-muted" aria-live="polite">
          Asking Qloo where your audience and {refs.length} reference{refs.length === 1 ? "" : "s"} live in {city}…
        </p>
      )}
      {error && <p role="alert" className="text-sm text-misses">{error}</p>}

      {data && view && (
        <div className="grid gap-6 @2xl:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <figure className="flex min-w-0 flex-col gap-2">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <span className="font-serif text-2xl italic">{data.city}</span>
              <span className="text-xs text-muted">{data.hoods.length} neighbourhoods · boundaries from Qloo</span>
            </div>
            <div
              ref={wrap}
              className="relative overflow-hidden rounded-xl border border-rule bg-desk/40"
              onMouseLeave={() => setHover(null)}
            >
              <svg
                viewBox={`-8 -8 ${W + 16} ${view.H + 16}`}
                className="mx-auto block h-auto max-h-[620px] w-full"
                role="img"
                aria-label={`Map of ${data.city}: ${summary}`}
                onMouseMove={(e) => {
                  const r = wrap.current?.getBoundingClientRect();
                  if (r) setPointer({ x: e.clientX - r.left, y: e.clientY - r.top, w: r.width });
                }}
              >
                {data.hoods.map((h) => {
                  const f = fillFor(h.id);
                  return (
                    <path
                      key={h.id}
                      d={view.path(h.rings)}
                      style={{ fill: f.color, fillOpacity: f.opacity, transition: "fill 300ms ease, fill-opacity 300ms ease" }}
                      className="stroke-sheet"
                      strokeWidth={0.8}
                      onMouseEnter={() => setHover(h.id)}
                    />
                  );
                })}
                {focusHood && (
                  <path d={view.path(focusHood.rings)} fill="none" className="pointer-events-none stroke-ink" strokeWidth={2.5} strokeLinejoin="round" />
                )}
                {placeLabels(
                  labelled.flatMap((id) => {
                    const h = data.hoods.find((x) => x.id === id);
                    return h ? [{ id, name: h.name, at: view.centre(h.rings) }] : [];
                  }),
                  labelSize,
                ).map(({ id, name: label, at: [x, y] }) => (
                  <text
                    key={id}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    className="pointer-events-none fill-ink stroke-sheet font-medium"
                    fontSize={labelSize}
                    strokeWidth={4}
                    paintOrder="stroke"
                  >
                    {label}
                  </text>
                ))}
              </svg>
              {hover && pointer && (
                <div
                  className="pointer-events-none absolute z-10 flex w-56 flex-col gap-1 rounded-lg border border-rule bg-sheet p-3 text-xs shadow-lg"
                  style={{ left: Math.min(pointer.x + 14, pointer.w - 232), top: pointer.y + 14 }}
                >
                  <span className="font-medium text-ink">{nameOf(hover)}</span>
                  <span className="text-muted">
                    {audRank.has(hover) ? (
                      <>
                        Your audience: <span className="font-mono text-ink">#{audRank.get(hover)! + 1}</span> of {data.audience.ranked.length}
                      </>
                    ) : (
                      "Not among your audience's ranked neighbourhoods"
                    )}
                  </span>
                  {selected && (
                    <span className="text-muted">
                      {selected.name} fans:{" "}
                      {refRank.has(hover) ? <span className="font-mono text-ink">#{refRank.get(hover)! + 1}</span> : "not in their top"}
                    </span>
                  )}
                  {selected && audTop.has(hover) && refTop.has(hover) && <span className="font-medium text-lands">Both: a place to run it</span>}
                </div>
              )}
            </div>
            <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {selected ? (
                <>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-lands" /> Your audience and its fans</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent/40" /> Your audience only</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-mixed/45" /> Its fans only</span>
                </>
              ) : (
                <span className="flex items-center gap-2">
                  Stronger
                  <span className="h-2.5 w-24 rounded-full" style={{ background: "linear-gradient(90deg, var(--accent), color-mix(in srgb, var(--accent) 12%, transparent))" }} />
                  weaker over-index for your audience
                </span>
              )}
              <span>Hover any neighbourhood for its ranks.</span>
            </figcaption>
          </figure>

          <div className="flex min-w-0 flex-col gap-5">
            <p className="font-serif text-xl leading-snug">{summary}</p>

            <div className="flex flex-col gap-2" role="group" aria-label="Map layer">
              <span className="text-xs font-medium uppercase tracking-wider text-muted">Show on the map</span>
              <button
                type="button"
                onClick={() => setLayer("audience")}
                aria-pressed={!selected}
                className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm ${!selected ? "border-ink bg-desk" : "border-rule hover:border-accent"}`}
              >
                <span className="font-medium">{audience.label}</span>
                <span className="text-xs text-muted">where they live</span>
              </button>
              {data.references.map((r) => {
                const thin = r.ranked.length < MIN_LOCAL_DATA;
                return (
                  <button
                    key={`${r.role}-${r.entityId}`}
                    type="button"
                    onClick={() => setLayer(r.entityId)}
                    aria-pressed={layer === r.entityId}
                    disabled={thin}
                    title={thin ? `Too little local data in ${data.city} to map` : undefined}
                    className={`flex items-center justify-between gap-3 rounded-lg border px-3 py-2 text-left text-sm disabled:opacity-50 ${layer === r.entityId ? "border-ink bg-desk" : "border-rule hover:border-accent"}`}
                  >
                    <span className="flex min-w-0 flex-col">
                      <span className="truncate font-medium">
                        {r.role === "swap" && <span className="text-lands">→ </span>}
                        {r.name}
                      </span>
                      <span className="text-[11px] text-muted">{r.role === "swap" ? `swap for ${r.replaces}` : "in the copy"}</span>
                    </span>
                    {thin ? (
                      <span className="shrink-0 text-[11px] text-muted">no local data</span>
                    ) : (
                      <span className="flex shrink-0 items-center gap-2">
                        <Meter value={r.overlap} of={TOP.audience} />
                        <span className="w-9 text-right font-mono text-xs">{r.overlap}/{TOP.audience}</span>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex flex-col gap-2">
              <span className="text-xs font-medium uppercase tracking-wider text-muted">Run it here: your audience&apos;s 10 strongest</span>
              <ol className="grid grid-cols-1 gap-x-2 gap-y-1 @md:grid-cols-2">
                {data.audience.ranked.slice(0, TOP.audience).map((id, i) => (
                  <li key={id}>
                    <button
                      type="button"
                      onMouseEnter={() => setFocusId(id)}
                      onMouseLeave={() => setFocusId(null)}
                      onFocus={() => setFocusId(id)}
                      onBlur={() => setFocusId(null)}
                      className={`flex w-full items-center gap-2 rounded-md px-2 py-1 text-left text-sm hover:bg-desk ${focusId === id ? "bg-desk" : ""}`}
                    >
                      <span className="w-5 font-mono text-xs text-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{nameOf(id)}</span>
                      {selected && (refTop.has(id) ? <span className="text-xs text-lands">✓ fans</span> : <span className="text-xs text-muted">–</span>)}
                    </button>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </div>
      )}

      {data && (
        <p className="border-t border-rule pt-3 text-xs text-muted">
          Where fans live isn&apos;t the same as what they like: a reference can be local to your audience and still score low on taste, so read this
          next to the verdicts above. {data.qlooCalls} Qloo heatmap and lookup calls.
        </p>
      )}
    </section>
  );
}

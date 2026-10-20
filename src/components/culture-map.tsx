"use client";

import { useMemo, useState } from "react";
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

type Cls = "both" | "audience" | "fans" | "strong" | "medium" | "weak" | "none";
const FILL: Record<Cls, string> = {
  both: "fill-lands",
  audience: "fill-accent/35",
  fans: "fill-mixed/35",
  strong: "fill-accent",
  medium: "fill-accent/45",
  weak: "fill-accent/15",
  none: "fill-rule/60",
};

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

  const view = useMemo(() => (data ? project(data.hoods) : null), [data]);
  const audTop = new Set(data?.audience.ranked.slice(0, TOP.audience));
  const selected = data?.references.find((r) => r.entityId === layer) ?? null;
  const refTop = new Set(selected?.ranked.slice(0, TOP.reference));
  const audRank = new Map(data?.audience.ranked.map((id, i) => [id, i]));
  const refRank = new Map(selected?.ranked.map((id, i) => [id, i]));
  const nameOf = (id: string) => data?.hoods.find((h) => h.id === id)?.name ?? "";

  const classOf = (id: string): Cls => {
    if (selected) return audTop.has(id) && refTop.has(id) ? "both" : audTop.has(id) ? "audience" : refTop.has(id) ? "fans" : "none";
    const r = audRank.get(id);
    return r === undefined ? "none" : r < TOP.audience ? "strong" : r < 30 ? "medium" : "weak";
  };
  const labelled = data
    ? selected
      ? data.audience.ranked.slice(0, TOP.audience).filter((id) => refTop.has(id)).slice(0, 6)
      : data.audience.ranked.slice(0, 5)
    : [];

  return (
    <section className="flex flex-col gap-4 rounded-xl border border-rule bg-sheet p-6" aria-label="Culture map">
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
        <div className="flex flex-col gap-4">
          <figure className="flex min-w-0 flex-col gap-2">
            <svg viewBox={`-8 -8 ${W + 16} ${view.H + 16}`} className="mx-auto h-auto max-h-[560px] w-full rounded-lg border border-rule bg-sheet" role="img" aria-label={`Map of ${data.city}`}>
              {data.hoods.map((h) => (
                <path key={h.id} d={view.path(h.rings)} className={`${FILL[classOf(h.id)]} stroke-sheet transition-colors`} strokeWidth={0.8}>
                  <title>
                    {[
                      h.name,
                      audRank.has(h.id) ? `your audience #${audRank.get(h.id)! + 1}` : null,
                      selected && refRank.has(h.id) ? `${selected.name} fans #${refRank.get(h.id)! + 1}` : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </title>
                </path>
              ))}
              {placeLabels(labelled.flatMap((id) => {
                const h = data.hoods.find((x) => x.id === id);
                return h ? [{ id, name: h.name, at: view.centre(h.rings) }] : [];
              }), Math.max(14, (view.H > W ? view.H : W) / 40)).map(({ id, name: label, at: [x, y] }) => {
                return (
                  <text
                    key={id}
                    x={x}
                    y={y}
                    textAnchor="middle"
                    className="pointer-events-none fill-ink stroke-sheet font-medium"
                    fontSize={Math.max(14, (view.H > W ? view.H : W) / 40)}
                    strokeWidth={4}
                    paintOrder="stroke"
                  >
                    {label}
                  </text>
                );
              })}
            </svg>
            <figcaption className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
              {selected ? (
                <>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-lands" /> Your audience and its fans</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent/35" /> Your audience only</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-mixed/35" /> Its fans only</span>
                </>
              ) : (
                <>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent" /> Your audience&apos;s 10 strongest</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-accent/45" /> Next 20</span>
                </>
              )}
              <span>Hover a neighbourhood for its rank.</span>
            </figcaption>
          </figure>

          <div className="grid min-w-0 gap-2 sm:grid-cols-2">
            <button
              type="button"
              onClick={() => setLayer("audience")}
              aria-pressed={!selected}
              className={`flex flex-col gap-1 rounded-lg border p-3 text-left ${!selected ? "border-ink" : "border-rule hover:border-accent"}`}
            >
              <span className="text-sm font-medium">{audience.label}</span>
              <span className="text-xs text-muted">Strongest in {data.audience.ranked.slice(0, 4).map(nameOf).join(", ")}</span>
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
                  className={`flex flex-col gap-1.5 rounded-lg border p-3 text-left disabled:opacity-60 ${layer === r.entityId ? "border-ink" : "border-rule hover:border-accent"}`}
                >
                  <span className="text-[10px] uppercase tracking-wider text-muted">{r.role === "swap" ? `Swap for ${r.replaces}` : "In the copy"}</span>
                  <span className="text-sm font-medium">
                    {r.role === "swap" && <span className="text-lands">→ </span>}
                    {r.name}
                  </span>
                  {thin ? (
                    <span className="text-xs text-muted">Too little local data in {data.city} to map.</span>
                  ) : (
                    <span className="flex flex-col gap-1 text-xs text-muted">
                      <Meter value={r.overlap} of={TOP.audience} />
                      Fans live in {r.overlap} of your audience&apos;s {TOP.audience} strongest neighbourhoods
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {data && (
        <div className="flex flex-col gap-1 border-t border-rule pt-3 text-xs text-muted">
          <p>
            <span className="font-medium text-ink">Run it here: </span>
            {data.audience.ranked.slice(0, 5).map(nameOf).join(" · ")}
          </p>
          <p>
            Where fans live isn&apos;t the same as what they like: a reference can be local to your audience and still score low on taste, so read
            this next to the verdicts above. {data.qlooCalls} Qloo heatmap and lookup calls.
          </p>
        </div>
      )}
    </section>
  );
}

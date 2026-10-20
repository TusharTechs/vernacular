// Culture Map: where in a city the audience lives, and whether each reference's
// fans live in the same neighbourhoods. Built on Qloo's locality heatmaps.

import { areaKm2, centroid, distanceKm, parseWkt, thin, type Ring } from "../qloo/geo";
import { localityHeatmap, type Evidence, type Locality } from "../qloo/tools";
import { resolveAudience } from "./score";
import type { AudienceSpec } from "./types";

/** How many of the audience's strongest neighbourhoods we check a reference against. */
export const MAP_TOP = { audience: 10, reference: 20 } as const;

export interface Hood {
  id: string;
  name: string;
  rings: Ring[];
}

export interface Layer {
  /** Neighbourhood ids, strongest first. */
  ranked: string[];
}

export interface ReferenceLayer extends Layer {
  name: string;
  entityId: string;
  role: "original" | "swap";
  /** For a swap, the original reference it replaces. */
  replaces?: string;
  /** How many of the audience's top neighbourhoods are also among this reference's top. */
  overlap: number;
}

export interface CityMap {
  city: string;
  hoods: Hood[];
  audience: Layer;
  references: ReferenceLayer[];
  evidence: Evidence[];
}

export interface MapReference {
  name: string;
  entityId: string;
  role: "original" | "swap";
  replaces?: string;
}

// Qloo mixes counties, states, townships and time zones in with neighbourhoods.
const NOT_A_NEIGHBOURHOOD = /\b(county|township|timezone|council district|state of|united states)\b/i;
const MIN_KM2 = 0.2;
const MAX_KM2 = 120;
const MAX_KM_FROM_CENTRE = 45;

/** Keep real neighbourhoods near the city, strongest first, with thinned outlines. */
export function neighbourhoods(city: string, localities: Locality[], around?: [number, number]): (Hood & { affinity: number })[] {
  const shaped = localities
    .filter((l) => !NOT_A_NEIGHBOURHOOD.test(l.name) && l.name.toLowerCase() !== city.trim().toLowerCase())
    .map((l) => ({ ...l, rings: parseWkt(l.boundary) }))
    .filter((l) => l.rings.length && areaKm2(l.rings) >= MIN_KM2 && areaKm2(l.rings) <= MAX_KM2);
  if (!shaped.length) return [];
  // Centre on the median neighbourhood so a stray far-off match can't stretch the map.
  const cs = shaped.map((l) => centroid(l.rings));
  const median = (xs: number[]) => xs.sort((a, b) => a - b)[Math.floor(xs.length / 2)];
  const centre: [number, number] = around ?? [median(cs.map((c) => c[0])), median(cs.map((c) => c[1]))];
  return shaped
    .filter((_, i) => distanceKm(cs[i], centre) <= MAX_KM_FROM_CENTRE)
    .sort((a, b) => b.affinity - a.affinity)
    .map((l) => ({ id: l.id, name: l.name, affinity: l.affinity, rings: l.rings.map((r) => thin(r)) }));
}

export function overlapOf(audience: string[], reference: string[]) {
  const top = new Set(reference.slice(0, MAP_TOP.reference));
  return audience.slice(0, MAP_TOP.audience).filter((id) => top.has(id)).length;
}

export async function buildCityMap(city: string, spec: AudienceSpec, refs: MapReference[]): Promise<CityMap> {
  const { audience, evidence } = await resolveAudience(spec);
  const [aud, ...layers] = await Promise.all([
    localityHeatmap(city, {
      entityIds: audience.anchors.map((a) => a.id),
      age: audience.age,
      gender: audience.gender,
      segments: audience.segments,
      tags: audience.tags,
    }),
    ...refs.map((r) => localityHeatmap(city, { entityIds: [r.entityId] })),
  ]);
  const audienceHoods = neighbourhoods(city, aud.localities);
  if (!audienceHoods.length) throw new Error(`Qloo has no neighbourhood data for "${city}". Try a large US city such as Chicago or Los Angeles.`);

  const hoods = new Map<string, Hood>(audienceHoods.map((h) => [h.id, { id: h.id, name: h.name, rings: h.rings }]));
  // Reference layers are kept to the same part of the map as the audience.
  const cs = audienceHoods.map((h) => centroid(h.rings));
  const centre: [number, number] = [cs.reduce((s, c) => s + c[0], 0) / cs.length, cs.reduce((s, c) => s + c[1], 0) / cs.length];
  const audienceRanked = audienceHoods.map((h) => h.id);
  const references: ReferenceLayer[] = refs.map((r, i) => {
    const hs = neighbourhoods(city, layers[i].localities, centre);
    for (const h of hs) if (!hoods.has(h.id)) hoods.set(h.id, { id: h.id, name: h.name, rings: h.rings });
    const ranked = hs.map((h) => h.id);
    return { ...r, ranked, overlap: overlapOf(audienceRanked, ranked) };
  });

  return {
    city,
    hoods: [...hoods.values()],
    audience: { ranked: audienceRanked },
    references,
    evidence: [...evidence, aud.evidence, ...layers.map((l) => l.evidence)],
  };
}

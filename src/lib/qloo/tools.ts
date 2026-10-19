// Typed Qloo operations used by the Vernacular agent. Each returns its result
// plus the evidence (call id, path, params) so every claim in the UI can link
// back to the exact request that produced it.

import { qlooGet, type QlooCall } from "./client";
import { urn, type AgeBand, type EntityType } from "./params";

export interface Evidence {
  callId: string;
  path: string;
  params: Record<string, string>;
  ms: number;
  cached: boolean;
}

export interface QlooTag {
  id: string;
  name: string;
  type?: string;
}

export interface ResolvedEntity {
  id: string;
  name: string;
  type: EntityType;
  popularity?: number;
  tags: QlooTag[];
  disambiguation?: string;
}

export interface Audience {
  label: string;
  anchors: ResolvedEntity[];
  age?: AgeBand;
  gender?: "male" | "female";
  /** Applied only to place and brand references, where Qloo honours location. */
  location?: string;
  /** Qloo audience segment ids, e.g. urn:audience:life_stage:parents_with_young_children. */
  segments?: string[];
  /** Qloo tag ids the audience is into, e.g. urn:tag:genre:music:reggaeton. */
  tags?: string[];
}

type RawTag = { id?: string; tag_id?: string; name?: string; type?: string };
type RawEntity = {
  entity_id: string;
  name: string;
  popularity?: number;
  tags?: RawTag[];
  disambiguation?: string;
  affinity?: number;
  query?: { affinity?: number; explainability?: unknown; [k: string]: unknown };
};

const evidence = <T>(c: QlooCall<T>): Evidence => ({
  callId: c.meta.callId,
  path: c.meta.path,
  params: c.meta.params,
  ms: c.meta.ms,
  cached: c.meta.cached,
});

/** The docs show affinity both at the top level and under `query`; accept either. */
export function affinityOf(e: RawEntity): number | undefined {
  if (typeof e.query?.affinity === "number") return e.query.affinity;
  if (typeof e.affinity === "number") return e.affinity;
  return undefined;
}

function toEntity(e: RawEntity, type: EntityType): ResolvedEntity {
  return {
    id: e.entity_id,
    name: e.name,
    type,
    popularity: e.popularity,
    disambiguation: e.disambiguation,
    tags: (e.tags ?? [])
      .map((t) => ({ id: t.id ?? t.tag_id ?? "", name: t.name ?? "", type: t.type }))
      .filter((t) => t.id),
  };
}

const LOCATION_TYPES: EntityType[] = ["place", "brand", "destination"];

export function audienceSignals(audience: Audience, targetType: EntityType) {
  return {
    "signal.interests.entities": audience.anchors.length ? audience.anchors.map((a) => a.id).join(",") : undefined,
    "signal.demographics.age": audience.age,
    "signal.demographics.gender": audience.gender,
    "signal.demographics.audiences": audience.segments?.length ? audience.segments.join(",") : undefined,
    "signal.interests.tags": audience.tags?.length ? audience.tags.join(",") : undefined,
    "signal.location.query": audience.location && LOCATION_TYPES.includes(targetType) ? audience.location : undefined,
  };
}

// ------------------------------------------------------------------ resolve

export async function resolveEntity(query: string, type: EntityType, take = 3) {
  const call = await qlooGet<{ results?: RawEntity[] }>("/search", { query, types: urn(type), take });
  const candidates = (call.data.results ?? []).map((e) => toEntity(e, type));
  return { entity: candidates[0] ?? null, candidates, evidence: evidence(call) };
}

// ------------------------------------------------------------------ score

export interface Score {
  entityId: string;
  affinity: number;
}

/** Affinity of specific entities for an audience. Entities Qloo does not return are absent. */
export async function scoreForAudience(entityIds: string[], type: EntityType, audience: Audience) {
  const call = await qlooGet<{ results?: { entities?: RawEntity[] } }>("/v2/insights", {
    "filter.type": urn(type),
    ...audienceSignals(audience, type),
    "filter.results.entities": entityIds.join(","),
    take: Math.min(50, Math.max(1, entityIds.length)),
  });
  const scores: Score[] = [];
  for (const e of call.data.results?.entities ?? []) {
    const a = affinityOf(e);
    if (a !== undefined) scores.push({ entityId: e.entity_id, affinity: a });
  }
  return { scores, evidence: evidence(call) };
}

/** The audience's own top entities of a type, used as the reference distribution for percentiles. */
export async function audienceBaseline(type: EntityType, audience: Audience, take = 50) {
  const call = await qlooGet<{ results?: { entities?: RawEntity[] } }>("/v2/insights", {
    "filter.type": urn(type),
    ...audienceSignals(audience, type),
    take,
  });
  const affinities = (call.data.results?.entities ?? [])
    .map(affinityOf)
    .filter((a): a is number => a !== undefined)
    .sort((a, b) => a - b);
  return { affinities, evidence: evidence(call) };
}

/** Share of the baseline at or below `value`, 0–100. */
export function percentileOf(value: number, sortedBaseline: number[]): number {
  if (!sortedBaseline.length) return 0;
  let below = 0;
  for (const v of sortedBaseline) if (v <= value) below++;
  return Math.round((100 * below) / sortedBaseline.length);
}

// ------------------------------------------------------------------ demographics

export type AgeProfile = Partial<Record<AgeBand, number>>;

export async function ageSkew(entityId: string) {
  const call = await qlooGet<{ results?: { demographics?: { entity_id?: string; query?: { age?: AgeProfile } }[] } }>(
    "/v2/insights",
    { "filter.type": "urn:demographics", "signal.interests.entities": entityId },
  );
  const age = call.data.results?.demographics?.[0]?.query?.age ?? null;
  return { age, evidence: evidence(call) };
}

// ------------------------------------------------------------------ equivalents

export interface Equivalent extends ResolvedEntity {
  affinity?: number;
  explainability?: unknown;
}

export interface EquivalentsResult {
  candidates: Equivalent[];
  evidence: Evidence[];
  /** Which constraints had to be dropped to get results. */
  relaxed: ("genre_tags" | "popularity_floor")[];
}

/**
 * Same-type entities this audience over-indexes on, constrained to the
 * original's genre tags and a recognisability floor. Relaxes the tag filter,
 * then the popularity floor, if Qloo returns nothing.
 */
export async function findEquivalents(
  original: ResolvedEntity,
  audience: Audience,
  { take = 8, popularityFloor = 0.5, maxGenreTags = 3, tagIds }: { take?: number; popularityFloor?: number; maxGenreTags?: number; tagIds?: string[] } = {},
): Promise<EquivalentsResult> {
  const genre = tagIds?.length
    ? tagIds
    : original.tags.filter((t) => t.id.includes(":genre:")).slice(0, maxGenreTags).map((t) => t.id);
  const attempts: { tags?: string; floor?: number; relaxed: EquivalentsResult["relaxed"] }[] = [
    { tags: genre.length ? genre.join(",") : undefined, floor: popularityFloor, relaxed: [] },
    { floor: popularityFloor, relaxed: ["genre_tags"] },
    { relaxed: ["genre_tags", "popularity_floor"] },
  ];
  const ev: Evidence[] = [];
  for (const a of genre.length ? attempts : attempts.slice(1)) {
    const call = await qlooGet<{ results?: { entities?: RawEntity[] } }>("/v2/insights", {
      "filter.type": urn(original.type),
      ...audienceSignals(audience, original.type),
      "filter.tags": a.tags,
      "filter.popularity.min": a.floor,
      "filter.exclude.entities": original.id,
      "feature.explainability": "true",
      take,
    });
    ev.push(evidence(call));
    const candidates = (call.data.results?.entities ?? []).map((e) => ({
      ...toEntity(e, original.type),
      affinity: affinityOf(e),
      explainability: e.query?.explainability,
    }));
    if (candidates.length) return { candidates, evidence: ev, relaxed: a.relaxed };
  }
  return { candidates: [], evidence: ev, relaxed: ["genre_tags", "popularity_floor"] };
}

// ------------------------------------------------------------------ panel

const panels = new Map<EntityType, ResolvedEntity[]>();

/**
 * Well-known entities of a type (no audience signal), used as the yardstick for
 * percentiles: raw affinity is not comparable across audiences, but a
 * reference's standing among the same famous peers within one audience is.
 */
export async function referencePanel(type: EntityType, take = 40, popularityFloor = 0.85) {
  const cached = panels.get(type);
  if (cached) return { panel: cached, evidence: null };
  const call = await qlooGet<{ results?: { entities?: RawEntity[] } }>("/v2/insights", {
    "filter.type": urn(type),
    "filter.popularity.min": popularityFloor,
    take,
  });
  const panel = (call.data.results?.entities ?? []).map((e) => toEntity(e, type));
  if (panel.length) panels.set(type, panel);
  return { panel, evidence: evidence(call) };
}

/**
 * Affinity of `entityIds` for the audience, plus each one's percentile among
 * the type's reference panel scored in the same request.
 */
export async function scoreWithPanel(entityIds: string[], type: EntityType, audience: Audience) {
  const { panel, evidence: panelEvidence } = await referencePanel(type);
  const anchorIds = new Set(audience.anchors.map((a) => a.id));
  const ids = new Set(entityIds);
  const panelIds = panel.map((p) => p.id).filter((id) => !ids.has(id) && !anchorIds.has(id));
  const room = Math.max(0, 50 - entityIds.length);
  const { scores, evidence: scoreEvidence } = await scoreForAudience([...entityIds, ...panelIds.slice(0, room)], type, audience);
  const byId = new Map(scores.map((s) => [s.entityId, s.affinity]));
  const baseline = panelIds.map((id) => byId.get(id)).filter((a): a is number => a !== undefined).sort((a, b) => a - b);
  const results = entityIds.map((id) => {
    const affinity = byId.get(id);
    return {
      entityId: id,
      affinity: affinity ?? null,
      percentile: affinity === undefined || baseline.length < 10 ? null : percentileOf(affinity, baseline),
      isAnchor: anchorIds.has(id),
    };
  });
  return { results, baselineSize: baseline.length, evidence: [panelEvidence, scoreEvidence].filter((e): e is Evidence => !!e) };
}

// ------------------------------------------------------------------ tags

export async function searchTags(query: string, take = 8) {
  const call = await qlooGet<{ results?: { tags?: (RawTag & { popularity?: number; parents?: { type: string }[] })[] } }>(
    "/v2/tags",
    { "filter.query": query, take },
  );
  const tags = (call.data.results?.tags ?? []).map((t) => ({
    id: t.id ?? t.tag_id ?? "",
    name: t.name ?? "",
    type: t.type,
    popularity: t.popularity,
    appliesTo: (t.parents ?? []).map((p) => p.type),
  }));
  return { tags: tags.filter((t) => t.id), evidence: evidence(call) };
}

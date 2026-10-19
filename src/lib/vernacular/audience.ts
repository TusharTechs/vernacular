// Build an audience from a plain description ("Glossier's customers", "new
// parents in Austin who run"). The model only interprets the words and picks
// segments from Qloo's own catalog; every anchor it proposes comes from Qloo.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { qlooGet } from "../qloo/client";
import { AGE_BANDS, ENTITY_TYPES, urn, type EntityType } from "../qloo/params";
import { audienceSignals, resolveEntity, searchTags, type Audience, type Evidence, type ResolvedEntity } from "../qloo/tools";
import { claude, FALLBACK, MODEL, RefusalError } from "./llm";
import type { AudienceSpec } from "./types";

export const SEGMENT_TYPES = [
  "communities",
  "global_issues",
  "hobbies_and_interests",
  "investing_interests",
  "leisure",
  "life_stage",
  "lifestyle_preferences_beliefs",
  "political_preferences",
  "professional_area",
  "spending_habits",
] as const;

export interface Segment {
  id: string;
  name: string;
  group: string;
}

let catalog: { at: number; segments: Segment[] } | null = null;

/** Qloo's audience segments (about a hundred), cached for an hour. */
export async function segmentCatalog(): Promise<Segment[]> {
  if (catalog && Date.now() - catalog.at < 60 * 60 * 1000) return catalog.segments;
  const lists = await Promise.all(
    SEGMENT_TYPES.map(async (t) => {
      const r = await qlooGet<{ results?: { audiences?: { id?: string; name?: string }[] } }>("/v2/audiences", {
        "filter.audience.types": `urn:audience:${t}`,
        take: 50,
      });
      return (r.data.results?.audiences ?? [])
        .filter((a): a is { id: string; name: string } => !!a.id && !!a.name)
        .map((a) => ({ id: a.id, name: a.name, group: t.replaceAll("_", " ") }));
    }),
  );
  catalog = { at: Date.now(), segments: lists.flat() };
  return catalog.segments;
}

const Interpretation = z.object({
  label: z.string().describe("A short audience name for the UI, e.g. 'Glossier customers' or 'Austin running parents'."),
  named: z
    .array(z.object({ query: z.string(), type: z.enum(ENTITY_TYPES) }))
    .max(3)
    .describe("Brands, artists, shows, films, books or other entities explicitly named in the description. Empty if none are named."),
  interests: z
    .array(z.string())
    .max(3)
    .describe("Genres, styles, cuisines or activities the description mentions, as short keywords, e.g. 'reggaeton', 'skincare', 'trail running'."),
  segment_ids: z.array(z.string()).max(3).describe("Ids from the provided segment catalog that clearly match the description. Empty if none fit."),
  age: z.enum(AGE_BANDS).nullable().describe("Only if the description states or clearly implies an age range."),
  location: z.string().nullable().describe("A city or region if the description names one."),
});

const SYSTEM = `You turn a marketer's description of an audience into structured signals for Qloo's taste graph.

- named: only entities the description explicitly names. Do not add your own guesses about what the audience likes; Qloo supplies that.
- interests: genres, styles, cuisines or activities the description mentions (not named entities). They are matched to Qloo tags.
- segment_ids: choose only from the catalog provided, and only segments the description clearly supports.
- age and location: only when stated or unmistakably implied ("college students" implies 24_and_younger; "retirees" implies 55_and_older).`;

export interface AudienceProposal {
  spec: AudienceSpec;
  /** What Qloo says this audience over-indexes on, across domains. */
  fingerprint: (ResolvedEntity & { affinity: number | null })[];
  segments: Segment[];
  named: ResolvedEntity[];
  evidence: Evidence[];
}

const FINGERPRINT_TYPES: EntityType[] = ["artist", "tv_show", "movie", "brand"];

export async function proposeAudience(description: string): Promise<AudienceProposal> {
  const segments = await segmentCatalog();
  const response = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(Interpretation) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Segment catalog (id: name, group):\n${segments.map((s) => `${s.id}: ${s.name} (${s.group})`).join("\n")}\n\nDescription:\n<description>${description}</description>`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new RefusalError(response.stop_details?.category);
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Could not interpret that audience description.");

  const evidence: Evidence[] = [];
  const picked = parsed.segment_ids.map((id) => segments.find((s) => s.id === id)).filter((s): s is Segment => !!s);
  const named: ResolvedEntity[] = [];
  for (const n of parsed.named) {
    const r = await resolveEntity(n.query, n.type);
    evidence.push(r.evidence);
    if (r.entity) named.push(r.entity);
  }
  const tags: { id: string; name: string }[] = [];
  for (const keyword of parsed.interests) {
    const r = await searchTags(keyword, 5);
    evidence.push(r.evidence);
    const k = keyword.toLowerCase();
    const best = r.tags.find((t) => t.name.toLowerCase() === k) ?? r.tags.find((t) => t.name.toLowerCase().includes(k)) ?? r.tags[0];
    if (best && !tags.some((t) => t.id === best.id)) tags.push({ id: best.id, name: best.name });
  }
  if (!named.length && !picked.length && !parsed.age && !tags.length) {
    throw new Error("Describe the audience with a brand, artist or show they love, a life stage, an interest, or an age range.");
  }

  // Cross-domain fingerprint: what this audience over-indexes on in each domain.
  const base: Audience = {
    label: parsed.label,
    anchors: named,
    age: parsed.age ?? undefined,
    location: parsed.location ?? undefined,
    segments: picked.map((s) => s.id),
    tags: tags.map((t) => t.id),
  };
  const fingerprint: AudienceProposal["fingerprint"] = [];
  for (const type of FINGERPRINT_TYPES) {
    if (named.some((n) => n.type === type) && type !== "brand") continue;
    const call = await qlooGet<{ results?: { entities?: { entity_id: string; name: string; popularity?: number; query?: { affinity?: number } }[] } }>(
      "/v2/insights",
      {
        "filter.type": urn(type),
        ...audienceSignals(base, type),
        "filter.popularity.min": 0.6,
        // A music-genre interest should also constrain the artist pick to that genre.
        "filter.tags": type === "artist" ? tags.filter((t) => t.id.includes(":genre:music:")).map((t) => t.id).join(",") || undefined : undefined,
        "filter.exclude.entities": named.length ? named.map((n) => n.id).join(",") : undefined,
        take: 3,
      },
    );
    evidence.push({ callId: call.meta.callId, path: call.meta.path, params: call.meta.params, ms: call.meta.ms, cached: call.meta.cached });
    const top = call.data.results?.entities?.[0];
    if (top) fingerprint.push({ id: top.entity_id, name: top.name, type, popularity: top.popularity, tags: [], affinity: top.query?.affinity ?? null });
  }

  const anchors = [...named, ...fingerprint.filter((f) => f.type !== "brand")].slice(0, 5);
  return {
    spec: {
      label: parsed.label,
      anchors: anchors.map((a) => ({ query: a.name, type: a.type })),
      age: parsed.age ?? undefined,
      location: parsed.location ?? undefined,
      segments: picked.map((s) => ({ id: s.id, name: s.name })),
      tags,
    },
    fingerprint,
    segments: picked,
    named,
    evidence,
  };
}

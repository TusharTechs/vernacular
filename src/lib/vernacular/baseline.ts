// "Claude alone": the same model, the same copy and the same audience
// description, but no Qloo. Its choices are then scored by Qloo exactly the way
// Vernacular's are, so the two can be compared on one measure.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { ENTITY_TYPES, type EntityType } from "../qloo/params";
import { ageSkew, resolveEntity, scoreWithPanel, type Audience, type Evidence } from "../qloo/tools";
import { claude, FALLBACK, MODEL, RefusalError } from "./llm";
import { resolveAudience, verdictFor } from "./score";
import type { AudienceSpec, Verdict } from "./types";

const Rewrite = z.object({
  swaps: z
    .array(
      z.object({
        original: z.string().describe("The reference being replaced, exactly as it appears in the copy."),
        replacement: z.string().describe("The new reference's canonical name."),
        type: z.enum(ENTITY_TYPES),
      }),
    )
    .max(12),
  rewritten: z.string().describe("The full copy with your replacements applied."),
});

const SYSTEM = `You adapt marketing copy for a specific audience. Replace any named cultural reference (artists, shows, films, brands, places, public figures) that this audience is unlikely to know or love with one they do, keeping the meaning, tone and length. Leave references that already fit. Use only real, specific, well-known entities.`;

export function describeAudience(spec: AudienceSpec) {
  return [
    spec.label,
    spec.anchors.length ? `who love ${spec.anchors.map((a) => a.query).join(", ")}` : null,
    spec.segments?.length ? `segments: ${spec.segments.map((s) => s.name).join(", ")}` : null,
    spec.tags?.length ? `into ${spec.tags.map((t) => t.name).join(", ")}` : null,
    spec.age ? `aged ${spec.age.replaceAll("_", " ")}` : null,
    spec.location ? `in ${spec.location}` : null,
  ]
    .filter(Boolean)
    .join("; ");
}

export interface BaselinePick {
  original: string;
  replacement: string;
  type: EntityType;
  matched: string | null;
  percentile: number | null;
  verdict: Verdict;
}

export interface BaselineResult {
  rewritten: string;
  picks: BaselinePick[];
  evidence: Evidence[];
}

async function scoreNames(items: { name: string; type: EntityType }[], audience: Audience) {
  const evidence: Evidence[] = [];
  const resolved = await Promise.all(items.map((i) => resolveEntity(i.name, i.type)));
  resolved.forEach((r) => evidence.push(r.evidence));
  const out: { matched: string | null; percentile: number | null; verdict: Verdict }[] = items.map(() => ({ matched: null, percentile: null, verdict: "unmeasured" }));
  const byType = new Map<EntityType, number[]>();
  resolved.forEach((r, i) => r.entity && byType.set(items[i].type, [...(byType.get(items[i].type) ?? []), i]));
  for (const [type, idx] of byType) {
    const { results, evidence: ev } = await scoreWithPanel(idx.map((i) => resolved[i].entity!.id), type, audience);
    evidence.push(...ev);
    for (const i of idx) {
      const id = resolved[i].entity!.id;
      const s = results.find((r) => r.entityId === id);
      const skew = audience.age ? await ageSkew(id) : null;
      if (skew) evidence.push(skew.evidence);
      const v = s?.isAnchor ? { verdict: "lands" as Verdict } : verdictFor(s?.percentile ?? null, skew?.age ?? null, audience.age);
      out[i] = { matched: resolved[i].entity!.name, percentile: s?.isAnchor ? 100 : (s?.percentile ?? null), verdict: v.verdict };
    }
  }
  return { out, evidence };
}

/** Claude's own rewrite, with no Qloo data. */
export async function baselineRewrite(text: string, spec: AudienceSpec) {
  const response = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 8000,
    ...FALLBACK,
    output_config: { effort: "medium", format: betaZodOutputFormat(Rewrite) },
    system: SYSTEM,
    messages: [{ role: "user", content: `Audience: ${describeAudience(spec)}\n\n<copy>\n${text}\n</copy>` }],
  });
  if (response.stop_reason === "refusal") throw new RefusalError(response.stop_details?.category);
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Could not read the baseline rewrite.");
  return {
    rewritten: parsed.rewritten,
    swaps: parsed.swaps.filter((s) => s.original.trim() && s.replacement.trim() && s.original !== s.replacement),
  };
}

export async function runBaseline(text: string, spec: AudienceSpec): Promise<BaselineResult> {
  const [parsed, { audience, evidence }] = await Promise.all([baselineRewrite(text, spec), resolveAudience(spec)]);
  const swaps = parsed.swaps;
  const { out, evidence: scoreEvidence } = await scoreNames(swaps.map((s) => ({ name: s.replacement, type: s.type })), audience);
  return {
    rewritten: parsed.rewritten,
    picks: swaps.map((s, i) => ({ original: s.original, replacement: s.replacement, type: s.type, ...out[i] })),
    evidence: [...evidence, ...scoreEvidence],
  };
}

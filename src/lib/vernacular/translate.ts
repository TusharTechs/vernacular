// Culture Translator: one reference, translated for several audiences at once.
// For each audience Qloo scores the original; if it doesn't land, Qloo proposes
// same-type equivalents the audience over-indexes on and verifies them, and the
// model picks the one that plays the same role. The output is a small cultural
// dictionary: "Seinfeld, in Gen Z" → "Derry Girls".

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { ENTITY_TYPES, type EntityType } from "../qloo/params";
import { ageSkew, findEquivalents, resolveEntity, scoreWithPanel, type ResolvedEntity } from "../qloo/tools";
import { claude, FALLBACK, MODEL, RefusalError } from "./llm";
import { resolveAudience, verdictFor } from "./score";
import type { AudienceSpec, Verdict } from "./types";

export type TranslateEvent =
  | { type: "subject"; name: string; entityType: EntityType; role: string }
  | { type: "scored"; index: number; audience: string; percentile: number | null; verdict: Verdict }
  | { type: "translation"; index: number; audience: string; keep: boolean; name: string | null; percentile: number | null; why: string }
  | { type: "done" }
  | { type: "error"; message: string };

const Subject = z.object({
  name: z.string().describe("Canonical name to search for."),
  type: z.enum(ENTITY_TYPES),
  role: z.string().describe("What this reference usually stands for in copy, in under 10 words, e.g. 'the sitcom everyone quotes'."),
});

const Picks = z.object({
  picks: z.array(
    z.object({
      index: z.number().int(),
      candidate: z.string().nullable().describe("The chosen candidate's name exactly as listed, or null if none fits the role."),
      why: z.string().describe("Under 18 words: why it plays the same role for this audience."),
    }),
  ),
});

async function identify(query: string): Promise<z.infer<typeof Subject>> {
  const r = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 1000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(Subject) },
    system:
      "Identify a cultural reference for a taste graph. type: artist (musicians and bands), movie, tv_show, book, podcast, videogame, brand, place (a specific venue), destination (a city or region), person (public figures who aren't primarily musicians).",
    messages: [{ role: "user", content: query }],
  });
  if (r.stop_reason === "refusal") throw new RefusalError(r.stop_details?.category);
  if (!r.parsed_output) throw new Error("Couldn't identify that reference.");
  return r.parsed_output;
}

export async function translate(query: string, audiences: AudienceSpec[], emit: (e: TranslateEvent) => void) {
  const subject = await identify(query);
  const found = await resolveEntity(subject.name, subject.type);
  if (!found.entity) throw new Error(`Qloo has no ${subject.type.replace("_", " ")} called "${subject.name}". Try the full name.`);
  const original: ResolvedEntity = found.entity;
  emit({ type: "subject", name: original.name, entityType: subject.type, role: subject.role });

  // Score the original for every audience and gather verified candidates where it doesn't land.
  const rows = await Promise.all(
    audiences.map(async (spec, index) => {
      const { audience } = await resolveAudience(spec);
      const { results } = await scoreWithPanel([original.id], subject.type, audience);
      const skew = audience.age ? (await ageSkew(original.id)).age : null;
      const p = results[0]?.isAnchor ? 100 : (results[0]?.percentile ?? null);
      const verdict = results[0]?.isAnchor ? "lands" : verdictFor(p, skew, audience.age).verdict;
      emit({ type: "scored", index, audience: spec.label, percentile: p, verdict });
      if (verdict === "lands") return { index, spec, keep: true as const, candidates: [] };
      const { candidates } = await findEquivalents(original, audience, { take: 8, popularityFloor: 0.6 });
      const top = candidates.slice(0, 5);
      const scored = top.length ? (await scoreWithPanel(top.map((c) => c.id), subject.type, audience)).results : [];
      const verified = top
        .map((c) => ({ name: c.name, percentile: scored.find((s) => s.entityId === c.id)?.percentile ?? null }))
        .filter((c) => c.percentile !== null && c.percentile >= 65);
      return { index, spec, keep: false as const, candidates: verified };
    }),
  );

  for (const r of rows.filter((r) => r.keep)) {
    emit({ type: "translation", index: r.index, audience: r.spec.label, keep: true, name: original.name, percentile: null, why: "Already lands with this audience." });
  }

  const open = rows.filter((r) => !r.keep && r.candidates.length);
  for (const r of rows.filter((r) => !r.keep && !r.candidates.length)) {
    emit({ type: "translation", index: r.index, audience: r.spec.label, keep: false, name: null, percentile: null, why: "Qloo found no verified equivalent that lands." });
  }
  if (!open.length) return emit({ type: "done" });

  const response = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 3000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(Picks) },
    system:
      "You pick cultural equivalents. For each audience, choose the candidate that best plays the same role as the original reference and that this audience would recognise as a household name. Only choose from the listed candidates (all verified on Qloo to land). Return null if none plays the role.",
    messages: [
      {
        role: "user",
        content: `Original: ${original.name} (${subject.type.replace("_", " ")}), which stands for: ${subject.role}\n\n${open
          .map((r) => `Audience ${r.index}: ${r.spec.label}\nCandidates: ${r.candidates.map((c) => `${c.name} (p${c.percentile})`).join("; ")}`)
          .join("\n\n")}`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new RefusalError(response.stop_details?.category);
  for (const r of open) {
    const pick = response.parsed_output?.picks.find((p) => p.index === r.index);
    const c = pick?.candidate ? r.candidates.find((x) => x.name === pick.candidate) : undefined;
    emit({
      type: "translation",
      index: r.index,
      audience: r.spec.label,
      keep: false,
      name: c?.name ?? null,
      percentile: c?.percentile ?? null,
      why: c ? pick!.why : "None of Qloo's verified equivalents plays the same role.",
    });
  }
  emit({ type: "done" });
}

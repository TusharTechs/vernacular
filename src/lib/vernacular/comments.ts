// Predicted comments: a simulated comment section for a post, before it's posted.
// Each commenter is a persona whose favourites come from Qloo for this audience,
// and how they react to each reference must follow that reference's Qloo verdict.
// The model writes the words; Qloo decides who the people are and what lands.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { qlooGet } from "../qloo/client";
import { urn, type EntityType } from "../qloo/params";
import { audienceSignals } from "../qloo/tools";
import { claude, FALLBACK, MODEL, RefusalError } from "./llm";
import { resolveAudience } from "./score";
import type { AudienceSpec, Verdict } from "./types";

const TASTE_TYPES: EntityType[] = ["artist", "tv_show", "movie", "brand"];
export const PERSONAS = 5;

export interface Persona {
  favourites: { type: EntityType; name: string }[];
}

export const MOODS = ["loves", "likes", "meh", "confused", "cringe"] as const;
export type Mood = (typeof MOODS)[number];

const Comment = z.object({
  persona: z.number().int().min(0).max(PERSONAS - 1),
  handle: z.string().describe("A made-up, plausible social handle, lowercase, no @. Never a real person's handle."),
  text: z.string().describe("The comment, under 25 words, in this persona's voice."),
  mood: z.enum(MOODS),
  about: z.string().nullable().describe("The reference the comment reacts to, exactly as named in the post, or null."),
});
const Output = z.object({
  original: z.array(Comment).length(PERSONAS),
  swaps: z.array(Comment).length(PERSONAS),
});
export type PredictedComment = z.infer<typeof Comment>;

export interface CommentInput {
  audience: AudienceSpec;
  original: { text: string; refs: { name: string; percentile: number | null; verdict: Verdict }[] };
  swaps: { text: string; refs: { name: string; percentile: number | null; verdict: Verdict }[] };
}

/** Five personas, each with different Qloo favourites for this audience. */
export async function personas(spec: AudienceSpec): Promise<Persona[]> {
  const { audience } = await resolveAudience(spec);
  const lists = await Promise.all(
    TASTE_TYPES.map(async (type) => {
      const call = await qlooGet<{ results?: { entities?: { name: string }[] } }>("/v2/insights", {
        "filter.type": urn(type),
        ...audienceSignals(audience, type),
        "filter.popularity.min": 0.6,
        "filter.exclude.entities": audience.anchors.length ? audience.anchors.map((a) => a.id).join(",") : undefined,
        take: 15,
      });
      return { type, names: (call.data.results?.entities ?? []).map((e) => e.name) };
    }),
  );
  return Array.from({ length: PERSONAS }, (_, i) => ({
    favourites: lists.flatMap((l) => {
      const pick = l.names[i * 2] ?? l.names[i];
      return pick ? [{ type: l.type, name: pick }] : [];
    }),
  }));
}

const SYSTEM = `You simulate the comment section under a social post, for a specific audience, so a marketer can preview reactions before posting.

You get five personas. Their favourites come from Qloo's taste data for this audience. You also get the post in two versions, and for each version, every cultural reference with its Qloo score for this audience (lands, mixed, misses).

Rules:
- Each persona comments once on each version, in character, and may mention one of their own favourites when natural.
- A reaction to a reference must follow its score: "lands" means they recognise and like it; "mixed" means lukewarm, ironic or "my parents love this"; "misses" means they don't get it, don't care, or find it dated. Never contradict a score.
- Comment on the post as a whole when a persona has nothing to say about a reference (about: null).
- Sound like real comments on the platform: short, casual, lowercase is fine, emoji sparingly. No hashtags spam, no slurs, nothing hateful, nothing about real private people.
- Handles are made up. Keep each persona's handle the same in both versions.`;

export async function predictComments(input: CommentInput): Promise<{ personas: Persona[]; original: PredictedComment[]; swaps: PredictedComment[] }> {
  const ps = await personas(input.audience);
  const describe = (v: CommentInput["original"]) =>
    `${v.text}\n\nReferences:\n${v.refs.map((r) => `- ${r.name}: ${r.verdict}${r.percentile !== null ? ` (p${r.percentile})` : ""}`).join("\n") || "- none"}`;
  const response = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 6000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(Output) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: [
          `Audience: ${input.audience.label}${input.audience.age ? `, aged ${input.audience.age.replaceAll("_", " ")}` : ""}`,
          `Personas:\n${ps.map((p, i) => `${i}. favourites: ${p.favourites.map((f) => `${f.name} (${f.type.replace("_", " ")})`).join(", ")}`).join("\n")}`,
          `<original>\n${describe(input.original)}\n</original>`,
          `<with_swaps>\n${describe(input.swaps)}\n</with_swaps>`,
        ].join("\n\n"),
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new RefusalError(response.stop_details?.category);
  if (!response.parsed_output) throw new Error("Could not read the predicted comments.");
  return { personas: ps, ...response.parsed_output };
}

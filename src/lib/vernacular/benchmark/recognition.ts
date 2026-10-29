// An outside check on the benchmark. Qloo is both Vernacular's source and the
// benchmark's grader, so this asks a model from a different family (OpenAI, not
// Claude, which also wrote the "Claude alone" arm) whether a typical member of
// the audience would know and like each reference. It sees the names shuffled
// and de-duplicated across all three versions, never which version used them.

import { z } from "zod";

export const RECOGNITION_MODEL = "gpt-5.5-2026-04-23";

const Ratings = z.object({
  ratings: z.array(z.object({ id: z.number().int(), score: z.number().int().min(1).max(5) })),
});

const SYSTEM = `You rate cultural references for an ad audience. For each reference, judge how likely a typical member of the audience is to recognise it AND feel positively about it if an ad aimed at them mentioned it.
1 = most of them wouldn't know it, or would find it dated or irrelevant to them
3 = a mixed or lukewarm reaction
5 = most of them know it and like it
Rate each reference on its own. Use the whole scale.`;

/** Scores 1–5 for each name, in the order given. */
export async function rateRecognition(audience: string, refs: { name: string; type: string }[]): Promise<number[]> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set.");
  const list = refs.map((r, i) => `${i}. ${r.name} (${r.type.replace("_", " ")})`).join("\n");
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: RECOGNITION_MODEL,
      messages: [
        { role: "system", content: SYSTEM },
        { role: "user", content: `Audience: ${audience}\n\nReferences:\n${list}\n\nReturn a rating for every id.` },
      ],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "ratings",
          strict: true,
          schema: {
            type: "object",
            additionalProperties: false,
            required: ["ratings"],
            properties: {
              ratings: {
                type: "array",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["id", "score"],
                  properties: { id: { type: "integer" }, score: { type: "integer", minimum: 1, maximum: 5 } },
                },
              },
            },
          },
        },
      },
    }),
    signal: AbortSignal.timeout(180_000),
  });
  if (!res.ok) throw new Error(`OpenAI ${res.status}: ${(await res.text()).slice(0, 300)}`);
  const body = (await res.json()) as { choices: { message: { content: string } }[] };
  const parsed = Ratings.parse(JSON.parse(body.choices[0].message.content));
  const byId = new Map(parsed.ratings.map((r) => [r.id, r.score]));
  return refs.map((_, i) => {
    const s = byId.get(i);
    if (s === undefined) throw new Error(`No rating for "${refs[i].name}".`);
    return s;
  });
}

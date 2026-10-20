// Blind fidelity judge. Audience fit is measured on Qloo; this checks the other
// side of the trade: did a rewrite keep the copy's meaning and still read well?
// The judge sees two rewrites in random order and never learns which system
// wrote which.

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { claude, FALLBACK, MODEL, RefusalError } from "../llm";

const Rating = z.object({
  meaning: z.number().int().min(1).max(5).describe("1 = the offer or message changed; 5 = same message, same claims."),
  natural: z.number().int().min(1).max(5).describe("1 = awkward or forced; 5 = reads like a professional wrote it."),
  note: z.string().describe("One short sentence on the biggest issue, or 'None'."),
});
const Verdicts = z.object({ A: Rating, B: Rating });
export type Fidelity = z.infer<typeof Rating>;

const SYSTEM = `You review rewrites of marketing copy. The rewrites swap cultural references (artists, shows, brands and so on) to suit a different audience. Do not judge whether the new references suit the audience; that is measured separately. Judge only:
- meaning: does the rewrite keep the original's message, offer and claims, with each reference playing the same role?
- natural: does it read fluently, like a professional copywriter wrote it?
Rate each version independently on a 1–5 scale. An unchanged copy keeps its meaning fully.`;

export async function judgeFidelity(audience: string, original: string, a: string, b: string): Promise<{ A: Fidelity; B: Fidelity }> {
  const response = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 4000,
    ...FALLBACK,
    output_config: { effort: "low", format: betaZodOutputFormat(Verdicts) },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Target audience: ${audience}\n\n<original>\n${original}\n</original>\n\n<version_a>\n${a}\n</version_a>\n\n<version_b>\n${b}\n</version_b>`,
      },
    ],
  });
  if (response.stop_reason === "refusal") throw new RefusalError(response.stop_details?.category);
  if (!response.parsed_output) throw new Error("Could not read the judge's ratings.");
  return response.parsed_output;
}

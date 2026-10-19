// Step 1: find the cultural references in the copy (model inference).

import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import { ENTITY_TYPES } from "../qloo/params";
import { claude, FALLBACK, MODEL, RefusalError } from "./llm";
import type { ExtractedReference } from "./types";

export const MAX_REFERENCES = 12;

const Extraction = z.object({
  references: z
    .array(
      z.object({
        span: z.string().describe("The reference exactly as it appears in the text, character for character."),
        query: z.string().describe("Canonical name to search for, e.g. 'Seinfeld' or 'Frank Sinatra'."),
        type: z.enum(ENTITY_TYPES),
        role: z.string().describe("What the reference does in its sentence, in under 12 words."),
        sentence: z.string().describe("The full sentence containing the reference, copied exactly."),
      }),
    )
    .max(MAX_REFERENCES),
});

const SYSTEM = `You find cultural references in marketing and creative copy so they can be checked against a taste graph.

A cultural reference is a specific, named thing an audience might know: an artist or band, a film, a TV show, a book, a podcast, a video game, a brand, a restaurant or venue, a destination, or a public figure.

Rules:
- Only named, specific entities. Skip generic nouns ("a sitcom", "pizza"), the advertiser's own brand, and the product being sold.
- span and sentence must be exact substrings of the text so they can be located.
- type is the Qloo entity type that best fits: artist (musicians and bands), movie, tv_show, book, podcast, videogame, brand (companies, chains, products), place (a specific venue or restaurant location), destination (a city or region as a travel place), person (actors, athletes, public figures who aren't primarily musicians).
- If there are no references, return an empty list.`;

export async function extractReferences(text: string): Promise<ExtractedReference[]> {
  const response = await claude().beta.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    ...FALLBACK,
    output_config: { effort: "medium", format: betaZodOutputFormat(Extraction) },
    system: SYSTEM,
    messages: [{ role: "user", content: `<copy>\n${text}\n</copy>` }],
  });
  if (response.stop_reason === "refusal") throw new RefusalError(response.stop_details?.category);
  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Could not read the reference list from the model's response.");

  // Keep only references we can actually locate in the text.
  const seen = new Set<string>();
  return parsed.references
    .filter((r) => text.includes(r.span) && text.includes(r.sentence) && r.sentence.includes(r.span))
    .filter((r) => {
      const key = `${r.type}:${r.query.toLowerCase()}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((r, i) => ({ id: `r${i + 1}`, ...r }));
}

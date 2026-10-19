// Tour Mode: one piece of copy scored for several audiences at once.
// Extraction runs once; scoring runs per audience. No rewriting here; a cell
// opens the full check for that audience.

import { extractReferences } from "./extract";
import { MAX_TEXT_CHARS } from "./limits";
import { resolveAudience, scoreReferences } from "./score";
import type { AudienceSpec, ExtractedReference, ScoredReference } from "./types";
import type { ResolvedEntity } from "../qloo/tools";

export const MAX_TOUR_AUDIENCES = 5;

export interface TourInput {
  text: string;
  audiences: AudienceSpec[];
}

export type TourEvent =
  | { type: "extracted"; references: ExtractedReference[] }
  | { type: "audience"; index: number; anchors: ResolvedEntity[] }
  | { type: "scored"; index: number; references: ScoredReference[] }
  | { type: "audience_error"; index: number; message: string }
  | { type: "done"; stats: { qlooCalls: number; ms: number } }
  | { type: "error"; message: string };

export async function runTour(input: TourInput, emit: (e: TourEvent) => void) {
  const started = Date.now();
  const text = input.text.trim();
  if (!text) throw new Error("Paste some copy to check.");
  if (text.length > MAX_TEXT_CHARS) throw new Error(`Copy is limited to ${MAX_TEXT_CHARS.toLocaleString()} characters.`);
  if (input.audiences.length < 2 || input.audiences.length > MAX_TOUR_AUDIENCES) {
    throw new Error(`Tour Mode compares 2 to ${MAX_TOUR_AUDIENCES} audiences.`);
  }

  const [references, audiences] = await Promise.all([
    extractReferences(text),
    Promise.all(input.audiences.map((a) => resolveAudience(a))),
  ]);
  emit({ type: "extracted", references });
  const callIds = new Set<string>();
  audiences.forEach((a, index) => {
    a.evidence.forEach((e) => callIds.add(e.callId));
    emit({ type: "audience", index, anchors: a.audience.anchors });
  });
  if (!references.length) {
    emit({ type: "done", stats: { qlooCalls: callIds.size, ms: Date.now() - started } });
    return;
  }

  // One audience at a time: each fans out its own Qloo calls, and Qloo
  // answers bursts with 429s.
  for (let index = 0; index < audiences.length; index++) {
    const { audience, unresolved } = audiences[index];
    if (input.audiences[index].anchors.length && !audience.anchors.length) {
      emit({ type: "audience_error", index, message: `Qloo found none of: ${unresolved.join(", ")}` });
      continue;
    }
    try {
      const scored = await scoreReferences(references, audience);
      scored.forEach((s) => s.evidence.forEach((e) => callIds.add(e.callId)));
      emit({ type: "scored", index, references: scored });
    } catch (err) {
      console.error("tour audience failed:", err instanceof Error ? err.message : err);
      emit({ type: "audience_error", index, message: "Scoring failed for this audience. Try again." });
    }
  }
  emit({ type: "done", stats: { qlooCalls: callIds.size, ms: Date.now() - started } });
}

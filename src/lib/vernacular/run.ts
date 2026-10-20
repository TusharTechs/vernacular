// Orchestrates one check: extract (model) → score (Qloo) → swap agent (model + Qloo).

import { runSwapAgent } from "./agent";
import { applyChange } from "./diff";
import { extractReferences } from "./extract";
import { resolveAudience, scoreReferences } from "./score";
import { MAX_TEXT_CHARS } from "./limits";
import type { CheckEvent, CheckInput, CheckResult } from "./types";

export async function runCheck(input: CheckInput, emit: (e: CheckEvent) => void = () => {}): Promise<CheckResult> {
  const started = Date.now();
  const text = input.text.trim();
  if (!text) throw new Error("Paste some copy to check.");
  if (text.length > MAX_TEXT_CHARS) throw new Error(`Copy is limited to ${MAX_TEXT_CHARS.toLocaleString()} characters.`);
  if (!input.audience.anchors.length && !input.audience.age && !input.audience.segments?.length && !input.audience.tags?.length) {
    throw new Error("Describe the audience with at least one thing they love, a segment or an age band.");
  }

  const [{ audience, evidence: audienceEvidence, unresolved }, references] = await Promise.all([
    resolveAudience(input.audience),
    extractReferences(text),
  ]);
  if (input.audience.anchors.length && !audience.anchors.length) {
    throw new Error(`Qloo found none of the audience's taste anchors (${unresolved.join(", ")}). Try different names.`);
  }
  emit({ type: "audience", anchors: audience.anchors });
  emit({ type: "extracted", references });

  const scored = await scoreReferences(references, audience);
  for (const s of scored) emit({ type: "scored", reference: s });

  const weak = scored.filter((s) => s.entity && (s.verdict === "misses" || s.verdict === "mixed"));
  // One agent per sentence, in parallel: references in the same sentence share an
  // agent so their rewrites build on each other; different sentences can't clash.
  const groups = [...new Map(weak.map((w) => [w.sentence, weak.filter((x) => x.sentence === w.sentence)])).values()];
  const runs = await Promise.all(groups.map((g) => runSwapAgent(text, g, audience, emit)));
  const swaps = runs.flatMap((r) => r.swaps);
  const kept = runs.flatMap((r) => r.kept);
  const llmCalls = runs.reduce((n, r) => n + r.llmCalls, 0);

  const rewrittenText = swaps.reduce((t, sw) => applyChange(t, sw.change), text);

  const qlooCalls =
    audienceEvidence.length +
    new Set([...scored.flatMap((s) => s.evidence), ...swaps.flatMap((s) => s.evidence)].map((e) => e.callId)).size;

  const result: CheckResult = {
    input,
    audience: { label: audience.label, anchors: audience.anchors, age: audience.age, location: audience.location },
    references: scored,
    swaps,
    kept,
    rewrittenText,
    stats: { qlooCalls, llmCalls: 1 + llmCalls, ms: Date.now() - started },
  };
  emit({ type: "done", result });
  return result;
}

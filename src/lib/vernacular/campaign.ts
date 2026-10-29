// Campaign check: several ad variants × several audiences in one grid, the way an
// agency decides which version runs where. References are extracted once per
// variant; each audience then scores every variant's references in one pass (the
// same Qloo scoring as a full check). No rewriting here; a cell opens the full
// check, with swaps, for that variant and audience.

import { extractReferences } from "./extract";
import { AUDIENCE_PRESETS } from "./presets";
import { resolveAudience, scoreReferences } from "./score";
import type { AudienceSpec, ExtractedReference, ScoredReference, Verdict } from "./types";

export const CAMPAIGN_LIMITS = { variants: 5, audiences: 5, chars: 600 } as const;

export interface CampaignInput {
  variants: { name: string; text: string }[];
  audiences: AudienceSpec[];
}

export interface CampaignCell {
  variant: number;
  audience: number;
  /** Mean Qloo percentile of the variant's measured references for this audience. */
  fit: number | null;
  counts: Record<Verdict, number>;
  refs: { span: string; name: string | null; percentile: number | null; verdict: Verdict }[];
}

export type CampaignEvent =
  | { type: "extracted"; variant: number; references: ExtractedReference[] }
  | { type: "cells"; audience: number; cells: CampaignCell[] }
  | { type: "audience_error"; audience: number; message: string }
  | { type: "done"; stats: { qlooCalls: number; llmCalls: number; ms: number } }
  | { type: "error"; message: string };

const key = (r: { query: string; type: string }) => `${r.type}|${r.query.toLowerCase()}`;

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T, i: number) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export function cellFor(variant: number, audience: number, refs: ExtractedReference[], scored: Map<string, ScoredReference>): CampaignCell {
  const counts: Record<Verdict, number> = { lands: 0, mixed: 0, misses: 0, unmeasured: 0 };
  const rows = refs.map((r) => {
    const s = scored.get(key(r));
    const verdict = s?.verdict ?? "unmeasured";
    counts[verdict]++;
    return { span: r.span, name: s?.entity?.name ?? null, percentile: s?.percentile ?? null, verdict };
  });
  const measured = rows.filter((r) => r.percentile !== null);
  const fit = measured.length ? Math.round(measured.reduce((n, r) => n + r.percentile!, 0) / measured.length) : null;
  return { variant, audience, fit, counts, refs: rows };
}

export async function runCampaign(input: CampaignInput, emit: (e: CampaignEvent) => void, signal?: AbortSignal) {
  const started = Date.now();
  const variants = input.variants.map((v) => ({ ...v, text: v.text.trim() })).filter((v) => v.text);
  if (variants.length < 1) throw new Error("Paste at least one variant to check.");

  const [extracted, audiences] = await Promise.all([
    mapLimit(variants, 3, async (v, i) => {
      const refs = await extractReferences(v.text);
      emit({ type: "extracted", variant: i, references: refs });
      return refs;
    }),
    Promise.all(input.audiences.map((a) => resolveAudience(a))),
  ]);
  const callIds = new Set(audiences.flatMap((a) => a.evidence.map((e) => e.callId)));

  // Score each distinct reference once per audience, whichever variants use it.
  const unique = [...new Map(extracted.flat().map((r) => [key(r), r])).values()];
  for (let a = 0; a < audiences.length; a++) {
    signal?.throwIfAborted();
    const { audience, unresolved } = audiences[a];
    if (input.audiences[a].anchors.length && !audience.anchors.length) {
      emit({ type: "audience_error", audience: a, message: `Qloo found none of: ${unresolved.join(", ")}` });
      continue;
    }
    try {
      const scored = unique.length ? await scoreReferences(unique, audience) : [];
      scored.forEach((s) => s.evidence.forEach((e) => callIds.add(e.callId)));
      const byKey = new Map(scored.map((s) => [key(s), s]));
      emit({ type: "cells", audience: a, cells: extracted.map((refs, v) => cellFor(v, a, refs, byKey)) });
    } catch (err) {
      console.error("campaign audience failed:", err instanceof Error ? err.message : err);
      emit({ type: "audience_error", audience: a, message: "Scoring failed for this audience. Try again." });
    }
  }
  emit({ type: "done", stats: { qlooCalls: callIds.size, llmCalls: variants.length, ms: Date.now() - started } });
}

/** The example campaign the page opens on: one cold-brew line, four creative routes. */
export const SAMPLE_CAMPAIGN: CampaignInput = {
  variants: [
    { name: "Classic rock", text: "Brewed for mornings that feel like a Fleetwood Mac record and a rerun of Cheers. Bold enough for a Harley-Davidson weekend, smooth enough for the drive home." },
    { name: "Latin pop", text: "Brewed for mornings that feel like a Bad Bunny drop and a rewatch of Euphoria. Bold enough for a Jordan release day, smooth enough for the after-party." },
    { name: "Country", text: "Brewed for mornings that feel like a Morgan Wallen song and an episode of Yellowstone. Bold enough for a Bass Pro Shops run, smooth enough for the drive home." },
    { name: "Indie", text: "Brewed for mornings that feel like a Phoebe Bridgers record and an A24 movie night. Bold enough for a Patagonia trail weekend, smooth enough for the walk to Trader Joe's." },
  ],
  audiences: AUDIENCE_PRESETS.map((p) => p.spec),
};

export interface CampaignResult {
  checkedAt: string;
  input: CampaignInput;
  extracted: ExtractedReference[][];
  cells: CampaignCell[];
  stats: { qlooCalls: number; llmCalls: number; ms: number };
}

/** Runs a campaign check to completion and collects the grid (for the saved example). */
export async function collectCampaign(input: CampaignInput): Promise<CampaignResult> {
  const extracted: ExtractedReference[][] = [];
  const cells: CampaignCell[] = [];
  let stats: CampaignResult["stats"] = { qlooCalls: 0, llmCalls: 0, ms: 0 };
  await runCampaign(input, (e) => {
    if (e.type === "extracted") extracted[e.variant] = e.references;
    if (e.type === "cells") cells.push(...e.cells);
    if (e.type === "done") stats = e.stats;
  });
  return { checkedAt: new Date().toISOString(), input, extracted, cells, stats };
}
